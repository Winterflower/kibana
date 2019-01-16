/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import fs from 'fs';
import util from 'util';

import { ProgressReporter } from '.';
import { RepositoryUtils } from '../../common/repository_utils';
import { toCanonicalUrl } from '../../common/uri_util';
import { Document, IndexStats, IndexStatsKey, LspIndexRequest, RepositoryUri } from '../../model';
import { GitOperations } from '../git_operations';
import { EsClient } from '../lib/esqueue';
import { Logger } from '../log';
import { LspService } from '../lsp/lsp_service';
import { ServerOptions } from '../server_options';
import { detectLanguage, detectLanguageByFilename } from '../utils/detect_language';
import { AbstractIndexer } from './abstract_indexer';
import { BatchIndexHelper } from './batch_index_helper';
import {
  getDocumentIndexCreationRequest,
  getReferenceIndexCreationRequest,
  getSymbolIndexCreationRequest,
} from './index_creation_request';
import {
  DocumentIndexName,
  ReferenceIndexName,
  RepositoryDeleteStatusReservedField,
  RepositoryGitStatusReservedField,
  RepositoryLspIndexStatusReservedField,
  RepositoryReservedField,
  SymbolIndexName,
} from './schema';

export class LspIndexer extends AbstractIndexer {
  protected type: string = 'lsp';
  private batchIndexHelper: BatchIndexHelper;

  constructor(
    protected readonly repoUri: RepositoryUri,
    protected readonly revision: string,
    protected readonly lspService: LspService,
    protected readonly options: ServerOptions,
    protected readonly client: EsClient,
    protected readonly log: Logger
  ) {
    super(repoUri, revision, client, log);

    this.batchIndexHelper = new BatchIndexHelper(client, log);
  }

  public async start(progressReporter?: ProgressReporter) {
    try {
      return await super.start(progressReporter);
    } finally {
      if (!this.isCancelled()) {
        // Flush all the index request still in the cache for bulk index.
        this.batchIndexHelper.flush();
      }
    }
  }

  public cancel() {
    this.batchIndexHelper.cancel();
    super.cancel();
  }

  protected async prepareIndexCreationRequests() {
    return [
      getDocumentIndexCreationRequest(this.repoUri),
      getReferenceIndexCreationRequest(this.repoUri),
      getSymbolIndexCreationRequest(this.repoUri),
    ];
  }

  protected async prepareRequests() {
    try {
      const {
        workspaceRepo,
        workspaceRevision,
      } = await this.lspService.workspaceHandler.openWorkspace(this.repoUri, 'head');
      const workspaceDir = workspaceRepo.workdir();
      const gitOperator = new GitOperations(this.options.repoPath);
      const fileTree = await gitOperator.fileTree(
        this.repoUri,
        '',
        'HEAD',
        0,
        Number.MAX_SAFE_INTEGER,
        false,
        Number.MAX_SAFE_INTEGER
      );
      return RepositoryUtils.getAllFiles(fileTree)
        .filter((filePath: string) => {
          const lang = detectLanguageByFilename(filePath);
          return lang && this.lspService.supportLanguage(lang);
        })
        .map((filePath: string) => {
          const req: LspIndexRequest = {
            repoUri: this.repoUri,
            localRepoPath: workspaceDir,
            filePath,
            revision: workspaceRevision,
          };
          return req;
        });
    } catch (error) {
      this.log.error(`Prepare lsp indexing requests error.`);
      this.log.error(error);
      throw error;
    }
  }

  protected async cleanIndex(repoUri: RepositoryUri) {
    // Clean up all the symbol documents in the symbol index
    try {
      await this.client.deleteByQuery({
        index: SymbolIndexName(repoUri),
        body: {
          query: {
            match_all: {},
          },
        },
      });
      this.log.info(`Clean up symbols for ${repoUri} done.`);
    } catch (error) {
      this.log.error(`Clean up symbols for ${repoUri} error.`);
      this.log.error(error);
    }

    // Clean up all the reference documents in the reference index
    try {
      await this.client.deleteByQuery({
        index: ReferenceIndexName(repoUri),
        body: {
          query: {
            match_all: {},
          },
        },
      });
      this.log.info(`Clean up references for ${repoUri} done.`);
    } catch (error) {
      this.log.error(`Clean up references for ${repoUri} error.`);
      this.log.error(error);
    }

    // Clean up all the document documents in the document index but keep the repository document.
    try {
      await this.client.deleteByQuery({
        index: DocumentIndexName(repoUri),
        body: {
          query: {
            bool: {
              must_not: [
                {
                  exists: {
                    field: RepositoryReservedField,
                  },
                },
                {
                  exists: {
                    field: RepositoryGitStatusReservedField,
                  },
                },
                {
                  exists: {
                    field: RepositoryLspIndexStatusReservedField,
                  },
                },
                {
                  exists: {
                    field: RepositoryDeleteStatusReservedField,
                  },
                },
              ],
            },
          },
        },
      });
      this.log.info(`Clean up documents for ${repoUri} done.`);
    } catch (error) {
      this.log.error(`Clean up documents for ${repoUri} error.`);
      this.log.error(error);
    }
  }

  protected async processRequest(request: LspIndexRequest): Promise<IndexStats> {
    const stats: IndexStats = new Map<IndexStatsKey, number>()
      .set(IndexStatsKey.Symbol, 0)
      .set(IndexStatsKey.Reference, 0)
      .set(IndexStatsKey.File, 0);
    const { repoUri, revision, filePath, localRepoPath } = request;
    const lspDocUri = toCanonicalUrl({ repoUri, revision, file: filePath, schema: 'git:' });
    const symbolNames = new Set<string>();

    try {
      const response = await this.lspService.sendRequest('textDocument/full', {
        textDocument: {
          uri: lspDocUri,
        },
        reference: this.options.enableGlobalReference,
      });

      if (response && response.result.length > 0) {
        const { symbols, references } = response.result[0];
        for (const symbol of symbols) {
          await this.batchIndexHelper.index(SymbolIndexName(repoUri), symbol);
          symbolNames.add(symbol.symbolInformation.name);
        }
        stats.set(IndexStatsKey.Symbol, symbols.length);

        for (const ref of references) {
          await this.batchIndexHelper.index(ReferenceIndexName(repoUri), ref);
        }
        stats.set(IndexStatsKey.Reference, references.length);
      } else {
        this.log.debug(`Empty response from lsp server. Skip symbols and references indexing.`);
      }
    } catch (error) {
      this.log.error(`Index symbols or references error. Skip to file indexing.`);
      this.log.error(error);
    }

    const localFilePath = `${localRepoPath}${filePath}`;
    const lstat = util.promisify(fs.lstat);
    const stat = await lstat(localFilePath);

    const readLink = util.promisify(fs.readlink);
    const readFile = util.promisify(fs.readFile);
    const content = stat.isSymbolicLink()
      ? await readLink(localFilePath, 'utf8')
      : await readFile(localFilePath, 'utf8');

    const language = await detectLanguage(filePath, Buffer.from(content));
    const body: Document = {
      repoUri,
      path: filePath,
      content,
      language,
      qnames: Array.from(symbolNames),
    };
    await this.batchIndexHelper.index(DocumentIndexName(repoUri), body);
    stats.set(IndexStatsKey.File, 1);
    return stats;
  }
}

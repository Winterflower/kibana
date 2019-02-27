/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// @ts-ignore: implicit any for JS file
import { AnyEmbeddableFactory } from 'ui/embeddable/embeddables/embeddable_factory';
import { uiRegistry } from '../../registry/_registry';

/**
 * Registry of functions (EmbeddableFactoryProviders) which return an EmbeddableFactory.
 */
export const EmbeddableFactoriesRegistryProvider = uiRegistry({
  index: ['name'],
  name: 'embeddableFactories',
});

export class EmbeddableFactoryRegistry {
  private factories: { [key: string]: AnyEmbeddableFactory } = {};

  public registerFactory(factory: AnyEmbeddableFactory) {
    this.factories[factory.name] = factory;
  }

  public getFactoryByName(name: string) {
    return this.factories[name];
  }

  public getFactories() {
    return this.factories;
  }
}

export const embeddableFactories = new EmbeddableFactoryRegistry();

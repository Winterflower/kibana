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

import {
  EuiButton,
  EuiButtonEmpty,
  EuiEmptyPrompt,
  EuiLink,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiOverlayMask,
  EuiSelect,
} from '@elastic/eui';
import React from 'react';
import { ActionFactory, actionFactoryRegistry } from 'ui/embeddable';

function getActionFactoryOptions() {
  return Object.values(actionFactoryRegistry.getFactories())
    .filter(factory => !factory.isSingleton())
    .map((factory: ActionFactory) => ({
      value: factory.id,
      text: factory.title,
    }));
}

interface Props {
  onCreate: (type: string) => void;
  onClose: () => void;
}

interface State {
  newFactoryType: string;
}

export class CreateNewActionModal extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      newFactoryType: getActionFactoryOptions()[0].value,
    };
  }

  public render() {
    return (
      <EuiOverlayMask>
        <EuiModal onClose={this.props.onClose}>
          <EuiModalHeader>
            <EuiModalHeaderTitle>Choose a type of action to create</EuiModalHeaderTitle>
          </EuiModalHeader>

          <EuiModalBody>
            <EuiSelect
              options={getActionFactoryOptions()}
              value={this.state.newFactoryType}
              onChange={this.changeFactoryType}
            />
          </EuiModalBody>

          <EuiModalFooter>
            <EuiButtonEmpty onClick={this.props.onClose}>Cancel</EuiButtonEmpty>

            <EuiButton onClick={() => this.props.onCreate(this.state.newFactoryType)}>
              Create
            </EuiButton>
          </EuiModalFooter>
        </EuiModal>
      </EuiOverlayMask>
    );
  }
  private changeFactoryType = (e: any) => {
    this.setState({ newFactoryType: e.target.value });
  };
}

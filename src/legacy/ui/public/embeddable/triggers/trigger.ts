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

import { AnyAction, Container } from 'ui/embeddable';
import { Embeddable } from 'ui/embeddable/embeddables';
import {
  TriggerSavedObject,
  TriggerSavedObjectAttributes,
} from 'ui/embeddable/triggers/trigger_saved_object';

function isTriggerSavedObject(
  triggerSavedObject: TriggerSavedObject | { id: string; title: string }
): triggerSavedObject is TriggerSavedObject {
  return (triggerSavedObject as TriggerSavedObject).attributes !== undefined;
}
export class Trigger {
  public id: string;
  public description: string = '';
  public embeddableId: string = '';
  public embeddableType: string = '';
  public title: string;
  private actions: AnyAction[] = [];

  constructor(triggerSavedObject: TriggerSavedObject | { id: string; title: string }) {
    this.id = triggerSavedObject.id;

    if (isTriggerSavedObject(triggerSavedObject)) {
      this.title = triggerSavedObject.attributes.title;
      this.description = triggerSavedObject.attributes.description;
      this.embeddableId = triggerSavedObject.attributes.embeddableId;
      this.embeddableType = triggerSavedObject.attributes.embeddableType;
    } else {
      this.title = triggerSavedObject.title;
    }
  }

  public getCompatibleActions<EI, EO, CI, CO>({
    embeddable,
    container,
  }: {
    embeddable: Embeddable<EI, EO>;
    container: Container<CI, CO, EI>;
  }) {
    return this.actions.filter(action => {
      let remove = false;
      if (embeddable) {
        if (action.embeddableId !== '') {
          remove = action.embeddableId !== embeddable.id;
        } else if (action.embeddableType !== '') {
          remove = action.embeddableType !== embeddable.type;
        } else {
          remove = false;
        }
      }
      return !remove;
    });
  }

  public addAction(action: AnyAction) {
    this.actions.push(action);
  }

  public getActions() {
    return this.actions;
  }

  public containsAction(id: string) {
    return !!this.actions.find(action => action.id === id);
  }

  public removeAction(actionId: string) {
    this.actions = this.actions.filter(action => action.id !== actionId);
  }

  public getSavedObjectAttributes(): TriggerSavedObjectAttributes {
    return {
      title: this.title,
      description: this.description,
      embeddableId: this.embeddableId,
      embeddableType: this.embeddableType,
      actions: this.actions.map(action => action.id).join(';'),
    };
  }
}

/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/

import type { ContainerInfo, ImageInfo } from '@podman-desktop/api';
import type { ImageInfoUI } from './ImageInfoUI';
import moment from 'moment';

export class ImageUtils {
  // extract SHA256 from image id and take the first 12 digits
  getShortId(id: string): string {
    if (id.startsWith('sha256:')) {
      id = id.substring('sha256:'.length);
    }
    return id.substring(0, 12);
  }

  getCreated(created: number): Date {
    return moment.unix(created).toDate();
  }

  getName(repoTag: string): string {
    const indexTag = repoTag.lastIndexOf(':');
    if (indexTag > 0) {
      return repoTag.slice(0, indexTag);
    } else {
      return '';
    }
  }

  getTag(repoTag: string): string {
    const indexTag = repoTag.lastIndexOf(':');
    if (indexTag > 0) {
      return repoTag.slice(indexTag + 1);
    } else {
      return '';
    }
  }

  // determine if the image is used by a container or not
  getInUse(imageInfo: ImageInfo, repositoryTag?: string, containersInfo?: ContainerInfo[]): boolean {
    if (!containersInfo) {
      return false;
    }

    // if there is a container with the same image id and the same repository tag, it's in use
    // else check if we have an untagged ilmage and in that case we check that container is matching the image id
    return containersInfo.some(container => {
      return (
        (container.ImageID === imageInfo.Id && container.Image === repositoryTag) ||
        (!!repositoryTag === false && imageInfo.Id.includes(container.Image) && (imageInfo.RepoTags ?? []).length === 0)
      );
    });
  }

  getImagesInfoUI(imageInfo: ImageInfo, containersInfo: ContainerInfo[]): ImageInfoUI[] {
    if (!imageInfo.RepoTags) {
      return [
        {
          id: imageInfo.Id,
          shortId: this.getShortId(imageInfo.Id),
          created: this.getCreated(imageInfo.Created),
          size: imageInfo.Size,
          name: '<none>',
          engineId: imageInfo.engineId,
          tag: '',
          selected: false,
          status: this.getInUse(imageInfo, undefined, containersInfo) ? 'used' : 'unused',
          isManifest: imageInfo.isManifest,
        },
      ];
    } else {
      return imageInfo.RepoTags.map(repoTag => {
        return {
          id: imageInfo.Id,
          shortId: this.getShortId(imageInfo.Id),
          created: this.getCreated(imageInfo.Created),
          size: imageInfo.Size,
          name: this.getName(repoTag),
          engineId: imageInfo.engineId,
          tag: this.getTag(repoTag),
          selected: false,
          status: this.getInUse(imageInfo, repoTag, containersInfo) ? 'used' : 'unused',
          isManifest: imageInfo.isManifest,
        };
      });
    }
  }
}

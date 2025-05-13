#
# Copyright (C) 2024-2025 Red Hat, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# SPDX-License-Identifier: Apache-2.0

FROM scratch as builder
COPY packages/backend/dist/ /extension/dist
COPY packages/backend/package.json /extension/
COPY packages/backend/media/ /extension/media
COPY LICENSE /extension/
COPY packages/backend/icon.png /extension/
COPY packages/backend/bootable.woff2 /extension/
COPY README.md /extension/

# TEMPORARY. Permanent fix will be in the future when we can add all of this to vite script.
# We require the macadam.js binaries and library, so we will manually copy this over to the container image.
# we rely on `pnpm build` before creating the container image, so we can safely assume that the macadam.js binaries are already present in the node_modules directory
# and can copy them over to the container image.
COPY node_modules/@crc-org/macadam.js /extension/node_modules/@crc-org/macadam.js
# Copy over ssh2 and it's dependencies (run jq '.dependencies' node_modules/ssh2/package.json locally to see)
COPY node_modules/ssh2 /extension/node_modules/ssh2
COPY node_modules/asn1 /extension/node_modules/asn1
COPY node_modules/bcrypt-pbkdf /extension/node_modules/bcrypt-pbkdf
COPY node_modules/safer-buffer /extension/node_modules/safer-buffer
COPY node_modules/tweetnacl /extension/node_modules/tweetnacl

FROM scratch

LABEL org.opencontainers.image.title="Bootable Container Extension" \
        org.opencontainers.image.description="Podman Desktop extension for bootable OS containers (bootc) and generating disk images" \
        org.opencontainers.image.vendor="Red Hat" \
        io.podman-desktop.api.version=">= 1.10.0"

COPY --from=builder /extension /extension

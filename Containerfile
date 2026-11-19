#
# Copyright (C) 2025 Red Hat, Inc.
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

FROM registry.access.redhat.com/ubi10/nodejs-24-minimal:1791463197@sha256:498ccfc43f6fe349a4d87db6af6d83ab420e9450f3800140cdc90c290dcd462f AS builder

WORKDIR /opt/app-root/src

# pnpm runs an implicit dependency check before `run` scripts, which spawns a
# nested `pnpm install`. Setting CI here rather than per-RUN makes every pnpm
# invocation non-interactive, otherwise that nested install blocks on a prompt.
ENV CI=true

RUN npm i -g corepack@0.36.0 && corepack enable

COPY --chown=1001:1001 . .

RUN pnpm install
RUN pnpm build

# Assemble the extension layout, so the final stage is a single COPY
RUN mkdir -p /opt/app-root/extension
RUN cp -r packages/backend/dist /opt/app-root/extension/
RUN cp -r packages/backend/media /opt/app-root/extension/
RUN cp packages/backend/package.json /opt/app-root/extension/
RUN cp packages/backend/bootable.woff2 /opt/app-root/extension/
RUN cp packages/backend/icon.png /opt/app-root/extension/
RUN cp LICENSE /opt/app-root/extension/
RUN cp README.md /opt/app-root/extension/

# TEMPORARY. Permanent fix will be in the future when we can add all of this to vite script.
# We require the macadam.js binaries and library, so we will manually copy this over to the container image.
# Copy over ssh2 and its dependencies (run jq '.dependencies' node_modules/ssh2/package.json locally to see)
RUN mkdir -p /opt/app-root/extension/node_modules/@crc-org
RUN cp -r node_modules/@crc-org/macadam.js /opt/app-root/extension/node_modules/@crc-org/
RUN cp -r node_modules/ssh2 /opt/app-root/extension/node_modules/
# ssh2 depends on asn1
RUN cp -r node_modules/asn1 /opt/app-root/extension/node_modules/
# asn1 depends on safer-buffer
RUN cp -r node_modules/safer-buffer /opt/app-root/extension/node_modules/
# ssh2 depends on bcrypt-pbkdf
RUN cp -r node_modules/bcrypt-pbkdf /opt/app-root/extension/node_modules/
# bcrypt-pbkdf depends on tweetnacl
RUN cp -r node_modules/tweetnacl /opt/app-root/extension/node_modules/

FROM scratch

COPY --from=builder /opt/app-root/extension /extension

LABEL org.opencontainers.image.title="Bootable Container Extension" \
        org.opencontainers.image.description="Podman Desktop extension for bootable OS containers (bootc) and generating disk images" \
        org.opencontainers.image.vendor="Red Hat" \
        io.podman-desktop.api.version=">= 1.18.0"

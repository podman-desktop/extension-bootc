# BootC (Bootable Container) Extension for Podman Desktop

![](https://raw.githubusercontent.com/podman-desktop/extension-bootc/main/docs/img/banner.png)

Want to create a bootable operating system from a Containerfile? Download this extension!

Easily go from container to VM / ISO-on-a-USB / RAW image!

## Topics

- [Technology](#technology)
- [Use Case](#use-case)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [Advanced Usage](#advanced-usage)
- [Preferences](#preferences)
- [Offline / Airplane Mode](#offline--airplane-mode)
- [Known Issues](#known-issues)
- [Contributing](#contributing)

## Technology

The **Bootable Container (bootc)** extension uses [bootc-image-builder](https://github.com/osbuild/bootc-image-builder) in order to build bootable _container_ disk images.

Once a machine is created from the disk image, it can apply transactional updates "in place" from newly pushed container images (without creating a new disk image). For more information, see [bootc](https://bootc-dev.github.io/bootc/).

### Bootable Container Images

There are many projects at work at creating "bootc" images. Below is a non-exhaustive list of compatible images which are known to work with [`bootc-image-builder`](https://github.com/osbuild/bootc-image-builder).

| Distribution         | Repo                                                                                          | Examples                                                                                                                                                                | Docs                                                                                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **CentOS Stream 9**  | [`quay.io/centos-bootc/centos-bootc:stream9`](https://quay.io/centos-bootc/centos-bootc)      | [Examples](https://gitlab.com/fedora/bootc/examples)                                                                                                                    | [Docs](https://docs.fedoraproject.org/en-US/bootc/)                                                                                                                |
| **CentOS Stream 10** | [`quay.io/centos-bootc/centos-bootc:stream10`](https://quay.io/centos-bootc/centos-bootc)     | [Examples](https://gitlab.com/fedora/bootc/examples)                                                                                                                    | [Docs](https://docs.fedoraproject.org/en-US/bootc/)                                                                                                                |
| **Fedora 42**        | [`quay.io/fedora/fedora-bootc:42`](https://quay.io/fedora/fedora-bootc)                       | [Examples](https://gitlab.com/fedora/bootc/examples)                                                                                                                    | [Docs](https://docs.fedoraproject.org/en-US/bootc/)                                                                                                                |
| **Fedora 43**        | [`quay.io/fedora/fedora-bootc:43`](https://quay.io/fedora/fedora-bootc)                       | [Examples](https://gitlab.com/fedora/bootc/examples)                                                                                                                    | [Docs](https://docs.fedoraproject.org/en-US/bootc/)                                                                                                                |
| **Fedora 44**        | [`quay.io/fedora/fedora-bootc:44`](https://quay.io/fedora/fedora-bootc)                       | [Examples](https://gitlab.com/fedora/bootc/examples)                                                                                                                    | [Docs](https://docs.fedoraproject.org/en-US/bootc/)                                                                                                                |
| **RHEL 9**           | [`registry.redhat.io/rhel9/rhel-bootc:latest`](https://catalog.redhat.com/search?gs&q=bootc)  | [Examples](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/using_image_mode_for_rhel_to_build_deploy_and_manage_operating_systems/index)  | [Docs](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/using_image_mode_for_rhel_to_build_deploy_and_manage_operating_systems/index) |
| **RHEL 10**          | [`registry.redhat.io/rhel10/rhel-bootc:latest`](https://catalog.redhat.com/search?gs&q=bootc) | [Examples](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/10/html/using_image_mode_for_rhel_to_build_deploy_and_manage_operating_systems/index) | [Docs](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/10/html/using_image_mode_for_rhel_to_build_deploy_and_manage_operating_systems/index)     |

The images can then be added to your Containerfile:

```Dockerfile
FROM quay.io/centos-bootc/centos-bootc:stream10
```

### Learning more

If you want to learn more about bootable containers, please refer to the [Fedora Getting Started Guide](https://docs.fedoraproject.org/en-US/bootc/getting-started/) where you can find a number of videos, demos, best practices and detailed information.

### Read Before Using

Some concepts to grasp before using.

#### Think of it as an OS provisioning tool!

You are "creating" an OS straight from a Containerfile, isn't that awesome?

**FIRST** realize that you are creating an OS with all your applications, developer tools, even games that you want.

**SECONDLY** ask yourself what applications you want to have running (perhaps on boot too!).

#### Creating your first bootable OS Containerfile

Want a quick straight-to-the-point Hello World Containerfile?

```Dockerfile
FROM quay.io/centos-bootc/centos-bootc:stream9
# Change your root password for a "test login" that
# allows to log in on a virtual/physical console
# NOTE: While some base images may set `PermitRootLogin prohibit-password`
# for OpenSSH, not all will.
# This is VERY dangerous and only meant for Hello World purposes.
RUN echo "root:root" | chpasswd
```

After creating your image you can now login and explore your bootable OS.

### Example images

Want to view more example images Such as [`httpd`](https://gitlab.com/bootc-org/examples/-/tree/main/httpd) and [`nvidia`](https://gitlab.com/bootc-org/examples/-/tree/main/nvidia)?

All of our maintained example images are on the [gitlab.com/fedora/bootc/examples](https://gitlab.com/fedora/bootc/examples) repo.

You can also pull our example image based on the [`httpd`](https://gitlab.com/bootc-org/examples/-/tree/main/httpd) example:

![](https://raw.githubusercontent.com/podman-desktop/extension-bootc/main/docs/img/clicking_pull.gif)

## Use Case

Go from a [bootc](https://bootc-dev.github.io/bootc/) compatible derived container build to a disk image format:

- `qcow2`: QEMU Disk Images
- `ami`: Amazon Machine Images
- `raw`: RAW disk image an MBR or GPT partition table
- `anaconda-iso`: Unattended installation method (USB sticks / install-on-boot)
- `vmdk`: Usable in vSphere
- `vhd`: Virtual Hard Disk
- `gce`: Google Cloud Engine

The list above is what is supported by the underlying `bootc-image-builder` technology. The list can [be found here](https://github.com/osbuild/bootc-image-builder?tab=readme-ov-file#-image-types).

## Requirements

### Prerequisites: Software and hardware requirements

**OS:**

Compatible on Windows, macOS & Linux

**Software:**

- [Podman Desktop 1.10.0+](https://github.com/podman-desktop/podman-desktop)
- [Podman 5.0.1+](https://github.com/containers/podman)

### Podman Machine (macOS / Windows)

Podman Machine is required for macOS and Windows in order to run Podman as well as utilize filesystem privileges to build a disk image.

Podman Machine requirements:

- **Rootful mode enabled**
- _At least_ 6GB of RAM allocated in order to build the disk image

Rootful mode can be enabled through the CLI to an already deployed VM:

```sh
podman machine stop
podman machine set --rootful
podman machine start
```

Or set when initially creating a Podman Machine via Podman Desktop:

![rootful setup](https://raw.githubusercontent.com/podman-desktop/extension-bootc/main/docs/img/rootful_setup.png)

### Escalated Privileges (Linux)

During the build process, **you will be asked to enter your credentials** so that the bootc extension may run a `sudo podman run` underlying CLI command.

Podman Desktop is ran as the logged-in user. However, bootc-image-builder requires escalated / sudo privileges to run a rootful container.

You can find more information about what specific commands are being ran from the console logs of Podman Desktop.

## Installation

This extension can be installed through the **Extensions** section of Podman Desktop within the **Catalog** tab:

1. Go to **Extensions** in the navbar.
2. Click on the **Catalog** tab.
3. Install the extension.

![](https://raw.githubusercontent.com/podman-desktop/extension-bootc/main/docs/img/catalog_install.gif)

### Nightly version

A version of the extension using the latest commit changes can be installed via the **Install custom...** button with the following link:

```
ghcr.io/podman-desktop/extension-bootc:next
```

## Usage

1. **Build your bootc-enabled Containerfile:**

> In the example below, we are going to change the root password for testing purposes when accessing the OS.

```Dockerfile
FROM quay.io/centos-bootc/centos-bootc:stream10

# Change the root password
# CAUTION: This is NOT recommended and is used only for testing / hello world purposes
RUN echo "root:root" | chpasswd
```

![](https://raw.githubusercontent.com/podman-desktop/extension-bootc/main/docs/img/build_image.gif)

2. **Build the disk image:**

> Build the disk image, this takes approximately 2-5 minutes depending on the performance of your machine.

![](https://raw.githubusercontent.com/podman-desktop/extension-bootc/main/docs/img/bootc_building.gif)

3. **Testing the image locally (macOS and Linux):**

> You can test the image locally on both macOS and Linux using the "Create VM" button on the "Disk Images" page. Windows support is upcoming.

**SSH requirements:** The VM creation feature only supports **ed25519** SSH keys. Ensure you have an ed25519 key pair generated (default location: `~/.ssh/id_ed25519`). To generate one:

```sh
ssh-keygen -t ed25519
```

Your public key information (ex. `ssh-ed25519 AAABBBCCC...`) from `~/.ssh/id_ed25519.pub` must be added to your bootc image during the build process for SSH access to work.

![](https://raw.githubusercontent.com/podman-desktop/extension-bootc/main/docs/img/vm.gif)

> **Note (macOS and Linux):** When performing virtual machine operations (create, start, stop, delete) for the first time, you will be prompted for your password to install the [macadam](https://github.com/crc-org/macadam) binary. This is a one-time installation that enables VM management. On macOS, the binary is installed to `/opt/macadam/bin/macadam`. On Linux, the binary will be installed automatically, but if issues occur it can be [installed manually](#linux-only-unable-to-create-virtual-machine).

![Escalated privileges prompt](https://raw.githubusercontent.com/podman-desktop/podman-desktop-extension-bootc/main/docs/img/escalated_privileges.png)

> **Note (Windows):** Windows support is currently _not supported_ due to Hyper-V limitations (must run as a privileged user), WSL2 support is _not supported_ due to Windows using a custom kernel for Virtual Machine usage which is incompatible with bootc-based images.

## Advanced usage

![](https://raw.githubusercontent.com/podman-desktop/extension-bootc/main/docs/img/balena_etcher.png)

### Booting the image

After building, there are multiple ways you can _use_ the outputting image format.

- **Virtually:** Use the built-in support in the extension that uses [macadam](https://github.com/crc-org/macadam), see our [usage](#usage) guide.
- **Third-party software:** Launch the image using your preferred virtualization software, such as VMware, VirtualBox, virt-manager (libvirt), QEMU, or GNOME Boxes.
- **USB flash drive:** Use tools like [balenaEtcher](https://www.balena.io/etcher/), [Rufus](https://rufus.ie/) or [Fedora MediaWriter](https://github.com/FedoraQt/MediaWriter) to flash the image to a USB stick. Then boot from it on real hardware.

### Using the `bootc` CLI tool

The `bootc` CLI command is the "bread-and-butter" of all bootc-derived images.

Once booted into the system, you can manage it using the `bootc` CLI:

- **Status:** `bootc status` shows the current image and version.
- **Upgrade:** `bootc upgrade` pulls the latest OCI image to apply next reboot.
- **Fetch:** `bootc fetch` pre-downloads an update without applying it.
- **Install:** `bootc install --target /dev/sdX` writes the OS to a block device, good for when "live booting" on a USB flash drive for testing.

See [bootc-dev.github.io/bootc](https://bootc-dev.github.io/bootc) for more information.

## Preferences

Preferences such as the default `bootc-builder-image` as well as timeouts can be adjusted within the **Preferences** section of Podman Desktop.

![](https://raw.githubusercontent.com/podman-desktop/extension-bootc/main/docs/img/preferences.png)

## Offline / airplane mode

Planning to build disk images on an airplane, train, or somewhere with slow/no internet? You can pre-download all the required container images needed to run the bootc extension beforehand.

**Note:** ISO builds (`anaconda-iso`) will **not** work offline as they pull RPMs during the build process. Use `qcow2`, `raw`, `vmdk`, `vhd`, or other formats for offline builds.

### Pre-pulling the bootc-image-builder (BIB) images

The extension uses `bootc-image-builder` to create disk images. Pull the appropriate builder for your base image:

```sh
# CentOS builder (default)
podman pull quay.io/centos-bootc/bootc-image-builder:sha256-c2d6830647c095e29c8cabd1ef6ae0e903e77675b953655428ac5cef147541a0

# RHEL 9 builder (requires Red Hat subscription)
podman pull registry.redhat.io/rhel9/bootc-image-builder:9.7

# RHEL 10 builder (requires Red Hat subscription)
podman pull registry.redhat.io/rhel10/bootc-image-builder:10.1
```

### Pre-pulling example images

The extension dashboard shows example images you can use. You can pre-pull these as well:

```sh
# Apache httpd web server
podman pull registry.gitlab.com/fedora/bootc/examples/httpd:latest

# Tailscale VPN
podman pull registry.gitlab.com/fedora/bootc/examples/tailscale:latest

# Podman systemd (container managed by systemd)
podman pull registry.gitlab.com/fedora/bootc/examples/app-podman-systemd:latest

# QEMU guest agent
podman pull registry.gitlab.com/fedora/bootc/examples/qemu-guest-agent:latest

# WiFi modules
podman pull registry.gitlab.com/fedora/bootc/examples/wifi:latest

# Kernel module management
podman pull registry.gitlab.com/fedora/bootc/examples/kernel-module:latest
```

### Pre-pulling base bootc images

You can also pre-pull the base image(s) you plan to build your own Containerfile's offline.

```sh
# CentOS
podman pull quay.io/centos-bootc/centos-bootc:stream9
podman pull quay.io/centos-bootc/centos-bootc:stream10

# Fedora
podman pull quay.io/fedora/fedora-bootc:42
podman pull quay.io/fedora/fedora-bootc:43
podman pull quay.io/fedora/fedora-bootc:44

# RHEL (requires Red Hat subscription)
podman pull registry.redhat.io/rhel9/rhel-bootc:latest
podman pull registry.redhat.io/rhel10/rhel-bootc:latest
```

### Example workflow for offline use

1. While online, pull the builder and base images you need
2. Build your bootc container image from your Containerfile
3. Go offline
4. Use the extension to build disk images (qcow2, raw, vmdk, etc.)

## Known issues

### (Windows only) Unable to use Hyper-V provider

Building with a Hyper-V Podman Machine is currently [not supported](https://github.com/podman-desktop/extension-bootc/issues/1963). The Podman Machine must be [setup using a WSL2 provider](https://podman-desktop.io/docs/installation/windows-install#use-wsl2-as-machine-provider).

### (macOS only) Unable to build cross-arch images

This is a [known upstream issue](https://github.com/osbuild/bootc-image-builder/issues?q=is%3Aissue+state%3Aopen+cross-arch) caused by limitations in `podman machine` and [Rosetta 2](https://support.apple.com/en-us/102527) compatibility.

_There is currently no workaround for macOS users._

If you need to build images for a different architecture (ex. AMD64), follow these steps:

1. **Build the image** for the target architecture: `podman build --platform linux/amd64 -t quay.io/username/my-bootc-image .`
2. **Push the image** to a registry: `podman push quay.io/username/my-bootc-image`
3. **Switch to a different machine** that matches the target architecture (ex. AMD64).
4. **Pull the image** on that machine: `podman pull quay.io/username/my-bootc-image`
5. **Build as usual** with the bootc extension.

Alternatively, you can also _export_ and _import_ the image between machines using [our managing images tutorial](https://podman-desktop.io/tutorial/managing-your-application-resources#managing-images).

### (Linux only) Unable to test virtual machine:

When testing a virtual machine on Linux through the bootc extension, you may encounter a "macadam binary is missing" or "gvproxy binary is missing" message. This is because the binaries required have to be installed manually.

Follow the below steps for the solution:

**macadam binary:**

1. Download the [macadam binary](https://github.com/crc-org/macadam/releases)
2. `chmod +x macadam-linux-amd64`
3. `sudo mv macadam-linux-amd64 /usr/local/bin/macadam`

**gvproxy binary:**

1. Download the [gvproxy binary](https://github.com/containers/gvisor-tap-vsock/releases)
2. `chmod +x gvproxy-linux-amd64`
3. `sudo mkdir /usr/libexec/podman`
4. `sudo mv gvproxy-linux-amd64 /usr/libexec/podman/gvproxy`

## Contributing

Want to help develop and contribute to the bootc extension? View our [CONTRIBUTING](https://github.com/podman-desktop/extension-bootc/blob/main/CONTRIBUTING.md) document.

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Windows users who want a personal desktop AI assistant and want to choose which
supported accounts and optional programs are configured during setup.

## Product Purpose

OpenJarvis provides two distinct desktop assistant applications: a Tauri-based
client with a local Python backend, and a legacy Tkinter client. Each is
packaged and installed independently.

## Capabilities and Constraints

- Windows x64 NSIS installers are required for both applications, with a `.bat`
  helper in the repository.
- Setup lets users choose which supported accounts to connect and which
  optional supported programs to install.
- Setup completes account linking in a setup flow before entering the main
  application; it does not collect provider passwords in the installer.
- Program installs are opt-in and use supported vendor flows.
- Developer Mode is off whenever either application launches. Advanced or
  newly added integrations can be exposed through an explicit setup toggle,
  but Developer Mode is off when the main application starts.

## Brand Commitments

The product name is OpenJarvis.

## Product Principles

- Users choose integrations and optional programs to configure.
- Setup and app launch do not silently connect accounts or install programs.
- Advanced settings remain opt-in, and Developer Mode starts off on every
  launch.

# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [0.0.3] - Unreleased
### Added
- Typescript definitions for the public API.
- Support for geometries with negated scales.

### Fixed
- Return value for GridMaterial.getCustomCacheKey().
- Made coplanar face intersections more robust.
- Case where coplanar faces were not handled properly with the `DIFFERENCE` operation.

## [0.0.2] - 2022-09-15
### Fixed
- Incorrect package.json "main" reference.

## [0.0.1] - 2022-07-19

Initial experimental version.

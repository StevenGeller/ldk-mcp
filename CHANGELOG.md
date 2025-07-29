# Changelog

## [1.1.0] - 2024-01-29

### Added
- Comprehensive Swift code examples with proper LDK Bindings namespace usage
- NetworkGraph and RapidGossipSync implementation tool
- Complete event handling patterns for all LDK event types
- Chain synchronization support for multiple backends:
  - Electrum
  - Esplora
  - Bitcoin Core RPC
  - Compact Filters (BIP157/158)
- Event persistence and recovery mechanisms
- Blockchain reorganization handling
- Enhanced Swift code generation following official LDK patterns

### Updated
- All Swift examples now use `Bindings.` namespace prefix
- Improved channel management examples with ChannelManagerConstructor
- Enhanced event handling with proper type safety
- Better error handling and recovery patterns

### Technical Improvements
- Added proper TypeScript types for all new tools
- Improved mock Lightning service for more realistic testing
- Better organization of Swift code examples
- Added comprehensive documentation for each tool

## [1.0.0] - 2024-01-28

### Initial Release
- Core Lightning operations (invoice generation, payments, channels)
- iOS-specific integration tools (Keychain, background tasks, biometric auth)
- Architecture guidance and best practices
- Test scenarios for common Lightning workflows
- Complete MCP server implementation
- Mock Lightning service for development
# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

### Adapter-Specific Context: VBus Adapter

This adapter connects ioBroker to RESOL VBus devices, specifically:
- **Primary Function**: Reading measurement data from RESOL VBus-based solar and heating controllers
- **Target Devices**: DeltaSol series controllers with built-in heat quantity meters (HQM)
- **Communication Methods**: 
  - Local TCP/IP via DL3/DL2 data loggers, KM2 communication modules
  - VBus/LAN interface adapters or serial/LAN gateways  
  - VBus/USB serial interface adapters
  - VBus.net remote access via DLx/KMx devices
- **Key Library**: Uses `resol-vbus` JavaScript library for VBus protocol communication
- **Data Processing**: Processes live VBus data streams and converts them to ioBroker states
- **Configuration Requirements**:
  - Connection type selection (TCP, Serial, VBus.net)
  - IP addresses or serial port paths for local connections
  - VBus passwords and channel selection
  - Update intervals for data polling
- **Connection Validation Patterns**:
  - IP format validation: `/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/`
  - FQDN format validation: `/^(?!:\/\/)(?=.{1,255}$)((.{1,63}\.){1,127}(?![0-9]*$)[a-z0-9-]+\.?)$/`
  - Serial port validation: `/^(COM|com)[0-9][0-9]?$|^\/dev\/tty.*$|^\/dev\/serial\/by-id\/usb-.*$|^\/dev\/serial\/by-path\/platform-.*$/i`

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        // Check for created states
                        const states = await harness.states.getStatesAsync('*');
                        const adapterStates = Object.keys(states).filter(id => 
                            id.startsWith('your-adapter.0.'));
                            
                        console.log(`Found ${adapterStates.length} adapter states`);
                        
                        if (adapterStates.length > 0) {
                            console.log('✅ SUCCESS: Adapter created states as expected');
                            resolve();
                        } else {
                            reject(new Error('No adapter states found'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });
        });
    }
});
```

#### Critical Integration Testing Best Practices

1. **Use Promisified Patterns**: Always use the async/await pattern with proper Promise wrapping for ioBroker database operations:
   ```javascript
   // ✅ CORRECT: Promisified approach
   const obj = await new Promise((resolve, reject) => {
       harness.objects.getObject(id, (err, result) => {
           if (err) return reject(err);
           resolve(result);
       });
   });
   
   // ❌ WRONG: Direct callback approach in async context
   harness.objects.getObject(id, (err, obj) => {
       // This won't work properly in async test context
   });
   ```

2. **Proper Error Handling in Tests**: 
   ```javascript
   it('should handle errors gracefully', async () => {
       try {
           // Test implementation
           const result = await someAdapterFunction();
           expect(result).toBeDefined();
       } catch (error) {
           // Fail test with clear error message
           throw new Error(`Test failed: ${error.message}`);
       }
   });
   ```

3. **State Validation Patterns**:
   ```javascript
   // Check for specific state values
   const connectionState = await harness.states.getStateAsync('adapter.0.info.connection');
   expect(connectionState.val).toBe(true);
   
   // Check state properties
   const temperatureState = await harness.states.getStateAsync('adapter.0.temperature');
   expect(temperatureState).toBeDefined();
   expect(typeof temperatureState.val).toBe('number');
   ```

4. **Timeout Management**:
   ```javascript
   it('should complete within reasonable time', function() {
       this.timeout(30000); // 30 second timeout for integration tests
       // Test implementation
   });
   ```

### VBus-Specific Testing Considerations

For the myvbus adapter specifically:

1. **Mock VBus Connections**: Since VBus devices may not be available during testing, mock the resol-vbus library:
   ```javascript
   const mockConnection = {
       connect: jest.fn().mockResolvedValue(),
       pipe: jest.fn().mockReturnThis(),
       on: jest.fn()
   };
   
   // Mock the vbus.Connection constructor
   jest.mock('resol-vbus', () => ({
       Connection: jest.fn(() => mockConnection),
       HeaderSet: jest.fn(),
       HeaderSetConsolidator: jest.fn()
   }));
   ```

2. **Test Configuration Validation**: Test all connection format validations:
   ```javascript
   describe('Configuration Validation', () => {
       it('should validate IP addresses correctly', () => {
           const validIPs = ['192.168.1.1', '10.0.0.1', '127.0.0.1'];
           const invalidIPs = ['256.1.1.1', '192.168', 'not.an.ip'];
           
           validIPs.forEach(ip => {
               expect(ipformat.test(ip)).toBe(true);
           });
           
           invalidIPs.forEach(ip => {
               expect(ipformat.test(ip)).toBe(false);
           });
       });
       
       it('should validate serial port paths correctly', () => {
           const validPorts = [
               'COM1', 'COM10', '/dev/ttyUSB0', 
               '/dev/serial/by-id/usb-1234567890',
               '/dev/serial/by-path/platform-abcdef'
           ];
           
           validPorts.forEach(port => {
               expect(serialformat.test(port)).toBe(true);
           });
       });
   });
   ```

## Logging Best Practices

Use appropriate logging levels throughout the adapter:

```javascript
// Error level - for errors that prevent normal operation
this.log.error(`Failed to connect to VBus device: ${error.message}`);

// Warning level - for recoverable issues
this.log.warn(`VBus connection temporarily lost, attempting reconnect`);

// Info level - for important operational information
this.log.info(`Connected to VBus device at ${this.config.connectionIdentifier}`);

// Debug level - for detailed troubleshooting information
this.log.debug(`Received VBus data packet: ${JSON.stringify(packet)}`);
```

## VBus Connection Management

When working with VBus connections, implement proper connection lifecycle management:

```javascript
class MyVbus extends utils.Adapter {
    constructor(options) {
        super({...options, name: 'myvbus'});
        this.vbusConnection = null;
    }

    async onReady() {
        try {
            // Validate configuration first
            const validationResult = await this.configIsValid(this.config);
            if (validationResult !== 'Configuration OK') {
                throw new Error(validationResult);
            }

            // Create and configure VBus connection
            this.vbusConnection = new vbus.Connection({
                // Connection configuration
            });

            // Set up event handlers
            this.vbusConnection.on('packet', (packet) => {
                this.processVBusPacket(packet);
            });

            // Connect
            await this.vbusConnection.connect();
            this.log.info('VBus connection established');

        } catch (error) {
            this.log.error(`Failed to initialize adapter: ${error.message}`);
        }
    }

    onUnload(callback) {
        try {
            // Clean up VBus connection
            if (this.vbusConnection) {
                this.vbusConnection.disconnect();
                this.vbusConnection = null;
            }
            
            // Clear timers
            if (this.connectionTimer) {
                clearInterval(this.connectionTimer);
                this.connectionTimer = undefined;
            }
            // Close connections, clean up resources
            callback();
        } catch (e) {
            callback();
        }
    }
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

## VBus Protocol Specifics

When implementing VBus-related functionality:

### Packet Processing
```javascript
processVBusPacket(packet) {
    try {
        // Extract measurement values from packet
        const spec = this.ctx.hsc.getSpecificationFile();
        const values = spec.getFieldsForHeaders([packet]);
        
        values.forEach(field => {
            // Convert field to ioBroker state
            const stateId = `${field.deviceName}.${field.name}`;
            const value = field.rawValue;
            
            // Handle different data types
            switch (field.unitId) {
                case 'DegreesCelsius':
                    this.setState(stateId, {
                        val: value / 10, // VBus temperature values are in 0.1°C
                        ack: true
                    });
                    break;
                case 'Percent':
                    this.setState(stateId, {
                        val: value,
                        ack: true
                    });
                    break;
                // Add more unit types as needed
            }
        });
    } catch (error) {
        this.log.error(`Error processing VBus packet: ${error.message}`);
    }
}
```

### State Object Creation
```javascript
createOrExtendObject(id, objData, value) {
    const self = this;
    self.getObject(id, (err, oldObj) => {
        if (!err && oldObj) {
            // Object exists, extend it
            self.extendObject(id, objData, () => {
                if (value !== undefined) {
                    self.setState(id, { val: value, ack: true });
                }
            });
        } else {
            // Create new object
            self.setObject(id, objData, () => {
                if (value !== undefined) {
                    self.setState(id, { val: value, ack: true });
                }
            });
        }
    });
}
```
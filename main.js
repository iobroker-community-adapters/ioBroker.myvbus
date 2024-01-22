// @ts-nocheck
/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

/*
 * Created with @iobroker/create-adapter v1.20.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');

// Load modules here, e.g.:
const vbus = require('resol-vbus');
const _ = require('lodash');
// Variable definitions

const ctx = {
    headerSet: new vbus.HeaderSet(),
    hsc: new vbus.HeaderSetConsolidator(),
    connection: new vbus.Connection()
};


const adapterName = require('./package.json').name.split('.').pop();
const ipformat = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const fqdnformat = /^(?!:\/\/)(?=.{1,255}$)((.{1,63}\.){1,127}(?![0-9]*$)[a-z0-9-]+\.?)$/;
const serialformat = /^(COM|com)[0-9][0-9]?$|^\/dev\/tty.*$/;
const vbusioformat = /vbus.io|vbus.net$/;

// Currently unused: const urlformat = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/;

class MyVbus extends utils.Adapter {
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({...options, name: adapterName});

        this.on('ready', this.onReady.bind(this));
        //this.on('objectChange', this.onObjectChange.bind(this));
        //this.on('stateChange', this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async main() {
    
        let relayActive = 'Relay X active';
        let language    = 'en';
        try {

            // Get system language and set it for this adapter
            await this.getForeignObjectAsync('system.config')
                .then(sysConf => {
                    if (sysConf && (sysConf.common.language === 'de' || sysConf.common.language === 'fr') ) {
                        // switch language to a language supported by Resol-Lib (de, fr), or default to english
                        language = sysConf.common.language;
                    }
                    // Set translation for relay active state
                    switch (language) {
                        case 'de': relayActive = 'Relais X aktiv';
                            break;
                        case 'fr': relayActive = 'Relais X actif';
                            break;
                    }
                });
            //.catch(err => {
            //    throw (err);
            //});

            const spec = new vbus.Specification({
                language: language
            });

            // Set up connection depending on connection device
            switch (this.config.connectionDevice) {
                case 'lan':
                    ctx.connection = new vbus.TcpConnection({
                        host: this.config.connectionIdentifier,
                        port: this.config.connectionPort,
                        password: this.config.vbusPassword
                    });
                    this.log.info('TCP Connection via LAN to [' + this.config.connectionIdentifier + ':' + this.config.connectionPort + '] selected');
                    break;
            
                case 'serial':
                    ctx.connection = new vbus.SerialConnection({
                        path: this.config.connectionIdentifier
                    });
                    this.log.info('Serial Connection at [' + this.config.connectionIdentifier + '] selected');
                    break;
            
                case 'langw':
                    ctx.connection = new vbus.TcpConnection({
                        host: this.config.connectionIdentifier,
                        port: this.config.connectionPort,
                        rawVBusDataOnly: true
                    });
                    this.log.info('TCP Connection via LAN-gw to [' + this.config.connectionIdentifier + ':' + this.config.connectionPort + '] selected');
                    break;
                    /**            
                case 'inet':
                    this.log.debug('VBus.net Connection via [' + this.config.vbusViaTag.substring(12, this.config.vbusViaTag.length) + '] selected');
                    this.log.debug('VBus.net Connection via [' + this.config.vbusViaTag.substring(0, 11) + '] selected');
                    ctx.connection = new vbus.TcpConnection({
                        //host: this.config.connectionIdentifier,
                        host: this.config.vbusViaTag.substring(12, this.config.vbusViaTag.length),
                        port: this.config.connectionPort,
                        password: this.config.vbusPassword,
                        viaTag: this.config.vbusViaTag.substring(0, 11)
                    });
                    this.log.info('VBus.net Connection via [' + this.config.vbusViaTag + '] selected');
                    break;
**/            
                case 'dl2':
                    if (this.config.connectionIdentifier.match(vbusioformat)) {
                        ctx.connection = new vbus.TcpConnection({
                            host: this.config.connectionIdentifier,
                            port: this.config.connectionPort,
                            password: this.config.vbusPassword,
                            viaTag: this.config.vbusViaTag
                        });
                        this.log.info('VBus.net Connection to KM2/DL2 via [' + this.config.connectionIdentifier + ' via ' + this.config.vbusViaTag + '] selected');
                    } else {
                        ctx.connection = new vbus.TcpConnection({
                            host: this.config.connectionIdentifier,
                            port: this.config.connectionPort,
                            password: this.config.vbusPassword
                        });
                        this.log.info('TCP Connection to KM2/DL2 on [' + this.config.connectionIdentifier + ':' + this.config.connectionPort + '] selected');
                    }
                    break;
            
                case 'dl3':
                    if (this.config.connectionIdentifier.match(vbusioformat)) {
                        ctx.connection = new vbus.TcpConnection({
                            host: this.config.connectionIdentifier,
                            port: this.config.connectionPort,
                            password: this.config.vbusPassword,
                            channel: this.config.vbusChannel,
                            viaTag: this.config.vbusViaTag
                        });
                        this.log.info('VBus.net Connection to DL3 channel ' + this.config.vbusChannel + ' via [' + this.config.connectionIdentifier + ' via ' + this.config.vbusViaTag + '] selected');
                    } else {
                        ctx.connection = new vbus.TcpConnection({
                            host: this.config.connectionIdentifier,
                            port: this.config.connectionPort,
                            password: this.config.vbusPassword,
                            channel: this.config.vbusChannel
                        });
                        this.log.info('TCP Connection to DL3 channel ' + this.config.vbusChannel + ' on [' + this.config.connectionIdentifier + ':' + this.config.connectionPort + '] selected');
                    }
            }
            
            /**
            // The adapters config (in the instance object everything under the attribute "native") is accessible via
            // this.config:
            const connectionDevice = this.config.connectionDevice;
            const connectionIdentifier = this.config.connectionIdentifier;
            const connectionPort = this.config.connectionPort;
            const vbusPassword = this.config.vbusPassword;
            const vbusChannel = this.config.vbusChannel;
            const vbusDataOnly = this.config.vbusDataOnly;
            const vbusViaTag = this.config.vbusViaTag;
            const vbusInterval = this.config.vbusInterval;

            this.log.debug(`Language: ${language}`);
            this.log.debug(`Connection Type: ${connectionDevice}`);
            this.log.debug(`Connection Identifier: ${connectionIdentifier}`);
            this.log.debug(`Connection Port: ${connectionPort}`);
            this.log.debug(`VBus Password: ${vbusPassword}`);
            this.log.debug(`VBus Channel: ${vbusChannel}`);
            this.log.debug(`VBus Via Tag: ${vbusViaTag}`);
            this.log.debug(`VBus Interval: ${vbusInterval}`);


            // Set up connection depending on connection device and check connection identifier
            switch (connectionDevice) {
                case 'lan':
                    if (connectionIdentifier.match(ipformat) || connectionIdentifier.match(fqdnformat)) {
                        ctx.connection = new vbus.TcpConnection({
                            host: connectionIdentifier,
                            port: connectionPort,
                            password: vbusPassword
                        });
                        this.log.info('TCP Connection to ' + connectionIdentifier + ' selected');
                    } else {
                        throw new Error(('Host-address not valid. Should be IP-address or FQDN'));
                    }
                    break;

                case 'serial':
                    if (connectionIdentifier.match(serialformat)) {
                        ctx.connection = new vbus.SerialConnection({
                            path: connectionIdentifier
                        });
                        this.log.info('Serial Connection at ' + connectionIdentifier + ' selected');
                    } else {
                        throw new Error(('Serial port ID not valid. Should be like /dev/ttyUSBserial or COM9'));
                    }
                    break;

                case 'langw':
                    if (connectionIdentifier.match(ipformat) || connectionIdentifier.match(fqdnformat)) {
                        ctx.connection = new vbus.TcpConnection({
                            host: connectionIdentifier,
                            port: connectionPort,
                            rawVBusDataOnly: vbusDataOnly
                        });
                        this.log.info('TCP Connection to ' + connectionIdentifier + ' selected');
                    } else {
                        throw new Error(('Host-address not valid. Should be IP-address or FQDN'));
                    }
                    break;

                case 'dl2':
                    if (connectionIdentifier.match(ipformat) || connectionIdentifier.match(fqdnformat)) {
                        if (connectionIdentifier.match(vbusioformat)) {
                            ctx.connection = new vbus.TcpConnection({
                                host: connectionIdentifier,
                                port: connectionPort,
                                password: vbusPassword,
                                viaTag: vbusViaTag
                            });
                            this.log.info('VBus.net Connection via ' + vbusViaTag + ' selected');
                        } else {
                            ctx.connection = new vbus.TcpConnection({
                                host: connectionIdentifier,
                                port: connectionPort,
                                password: vbusPassword
                            });
                            this.log.info('TCP Connection to ' + connectionIdentifier + ' selected');
                        }
                    } else {
                        throw new Error(('Host-address not valid. Should be IP-address or FQDN'));
                    }
                    break;

                case 'dl3':
                    if (connectionIdentifier.match(ipformat) || connectionIdentifier.match(fqdnformat)) {
                        if (connectionIdentifier.match(vbusioformat)) {
                            ctx.connection = new vbus.TcpConnection({
                                host: connectionIdentifier,
                                port: connectionPort,
                                password: vbusPassword,
                                viaTag: vbusViaTag,
                                channel: vbusChannel
                            });
                            this.log.info('VBus.net Connection via ' + vbusViaTag + ' selected');
                        } else {
                            ctx.connection = new vbus.TcpConnection({
                                host: connectionIdentifier,
                                port: connectionPort,
                                password: vbusPassword,
                                channel: vbusChannel
                            });
                            this.log.info('TCP Connection to ' + connectionIdentifier + ' selected');
                        }
                    } else {
                        throw new Error(('Host-address not valid. Should be IP-address or FQDN'));
                    }
            }
**/
            // Connection state handler
            ctx.connection.on('connectionState', (connectionState) => {
                
                switch (connectionState) {
                    case 'CONNECTED':
                        this.log.info('Connection established');
                        this.setStateAsync('info.connection', true, true);
                        break;
                    case 'INTERRUPTED': 
                        this.log.debug('Connection interrupted');               
                        this.setStateAsync('info.connection', false, true);
                        break;
                    case 'RECONNECTING':
                        this.log.warn('Connection interrupted, trying to reconnect');
                        this.setStateAsync('info.connection', false, true);
                        break;
                    default:
                        this.log.debug('Connection state changed to ' + connectionState);        
                }
            });
            
            ctx.headerSet = new vbus.HeaderSet();
            let hasSettled = false;
            let settledCountdown = 0;

            // Packet handler
            ctx.connection.on('packet', (packet) => {
                if (!hasSettled) {
                    const headerCountBefore = ctx.headerSet.getHeaderCount();
                    ctx.headerSet.addHeader(packet);
                    ctx.hsc.addHeader(packet);
                    const headerCountAfter = ctx.headerSet.getHeaderCount();

                    if (headerCountBefore !== headerCountAfter) {
                        ctx.hsc.emit('headerSet', ctx.hsc);
                        settledCountdown = headerCountAfter * 2;
                    } else if (settledCountdown > 0) {
                        settledCountdown -= 1;
                    } else {
                        hasSettled = true;
                    }
                } else {
                    ctx.headerSet.addHeader(packet);
                    ctx.hsc.addHeader(packet);
                }
            });

            ctx.hsc = new vbus.HeaderSetConsolidator({
                interval: this.config.vbusInterval * 1000,
                timeToLive: (this.config.vbusInterval * 1000) + 1000
            });

            // HeaderSetConsolidator handler - creates object tree and updates values in preset interval
            ctx.hsc.on('headerSet', () => {
                const packetFields = spec.getPacketFieldsForHeaders(ctx.headerSet.getSortedHeaders());
                const data = _.map(packetFields, function (pf) {
                    return {
                        id: pf.id,
                        name: _.get(pf, ['packetFieldSpec', 'name', language]),
                        rawValue: pf.rawValue,
                        deviceName: pf.packetSpec.sourceDevice.fullName,
                        deviceId: pf.packetSpec.sourceDevice.deviceId.replace(/_/g, ''),
                        addressId: pf.packetSpec.sourceDevice.selfAddress,
                        unitId: pf.packetFieldSpec.type.unit.unitId,
                        unitText: pf.packetFieldSpec.type.unit.unitText,
                        typeId: pf.packetFieldSpec.type.typeId,
                        precision: pf.packetFieldSpec.type.precision,
                        rootTypeId: pf.packetFieldSpec.type.rootTypeId,
                        parts: pf.packetFieldSpec.parts,
                    };
                });

                //this.log.debug('received data: ' + JSON.stringify(data));
                if (data[1]){
                // create device
                    this.createOrExtendObject(data[1].deviceId, {
                        type: 'device',
                        common: {
                            name: data[1].deviceName,
                            type: 'string'
                        },
                        native: {}
                    }, '');

                    // create channel
                    this.createOrExtendObject(data[1].deviceId + '.' + data[1].addressId, {
                        type: 'channel',
                        common: {
                            name: data[1].deviceId + '.' + data[1].addressId,
                            type: 'string'
                        },
                        native: {}
                    }, '');
                }
                // iterate over all data to create datapoints
                _.forEach(data, (item) => {
                    //this.log.debug('received item-data: ' + JSON.stringify(item));
                    const deviceId = item.deviceId.replace(/_/g, '');
                    const channelId = deviceId + '.' + item.addressId;
                    const objectId = channelId + '.' + item.id.replace(/_/g, '');
                    const isBitField = ((item.parts.length === 1) && (item.parts[0].mask !== 0xFF));
                    const isTimeField = ((item.rootTypeId === 'Time') || (item.rootTypeId === 'Weektime') || (item.rootTypeId === 'DateTime'));
                    const common = {
                        name: item.name,
                        type: 'number',
                        unit: item.unitText,
                        read: true,
                        write: false
                    };
                    let value;

                    if ((item.rawValue === undefined) || (item.rawValue === null)) {
                        value = 0;
                    } else if (item.rootTypeId === 'Number') {
                        value = +item.rawValue.toFixed(item.precision);
                    } else if (item.rootTypeId === 'Time') {
                        value = spec.i18n.moment(item.rawValue * 60000).utc().format('HH:mm');
                    } else if (item.rootTypeId === 'Weektime') {
                        value = spec.i18n.moment((item.rawValue + 5760) * 60000).utc().format('dd,HH:mm');
                    } else if (item.rootTypeId === 'DateTime') {
                        value = spec.i18n.moment((item.rawValue + 978307200) * 1000).utc().format('L HH:mm:ss');
                    }

                    switch (item.unitId) {
                        case 'DegreesCelsius':
                            common.min = -1000;
                            common.max = +1000;
                            common.role = 'value.temperature';
                            break;
                        case 'Percent':
                            common.min = 0;
                            common.max = 100;
                            common.role = 'level.volume';
                            // create Relay X active state (as far as we know these are the only percent-unit states )
                            this.createOrExtendObject(objectId + '_1', {
                                type: 'state',
                                common: {
                                    name: relayActive.replace('X', item.name.substr(item.name.length-2).replace(' ', '')),
                                    type: 'boolean',
                                    role: 'indicator.activity',
                                    unit: '',
                                    read: true,
                                    write: false
                                }
                            }, (value > 0));
                            break;
                        case 'Hours':
                            common.role = 'value';
                            break;
                        case 'WattHours':
                            common.role = 'value.power.generation';
                            break;
                        case 'None':
                            if (!isBitField) {
                                if (isTimeField) {
                                    common.role = 'value';
                                    common.type = 'string';
                                } else {
                                    common.role = 'value';
                                }
                            } else {
                                common.role = 'indicator.maintenance.alarm';
                                common.type = 'boolean';
                                value = (value === 1);
                            }
                            break;
                        default:
                            common.role = 'value';
                            break;
                    }
                    this.createOrExtendObject(objectId, {type: 'state', common}, value);
                });
            });
            // Establish connection   
            //this.log.debug('Decrypted password: ' + vbusPassword);          
            this.log.info('Wait for Connection...');
            await ctx.connection.connect();
            ctx.hsc.startTimer();
        } catch (error) {
            this.log.error(`[main()] error: ${error.message}`);
        }
    }
    
    /*
    * @param {object} config Current  active config for adapter
    * @returns {string} Result of the check
    * */
    async configIsValid(config) {
        //this.log.debug('configIsValid Function ');
        //this.log.debug('Entering Function [configIsValid]');
        // Log the current config given to the function
        this.log.debug(`Connection Type: ${this.config.connectionDevice}`);
        this.log.debug(`Connection Identifier: ${this.config.connectionIdentifier}`);
        this.log.debug(`Connection Port: ${this.config.connectionPort}`);
        this.log.debug(`VBus Password: ${this.config.vbusPassword}`);
        this.log.debug(`VBus Channel: ${this.config.vbusChannel}`);
        this.log.debug(`VBus Via Tag: ${this.config.vbusViaTag}`);
        this.log.debug(`VBus Interval: ${this.config.vbusInterval}`);
        return new Promise(
            function (resolve, reject) {
                // some helper functions
                function testSerialformat(config) {
                    if (!config.connectionIdentifier.match(serialformat)) {
                        reject('Serialformat is invalid! Please fix.');
                    }
                }
    
                function testIP_and_FQDN_Format(config) {
                    if (!config.connectionIdentifier.match(ipformat) && !config.connectionIdentifier.match(fqdnformat)) {
                        reject('[' + config.connectionIdentifier + '] is neither a valid IP-Format nor a fully qualified domain name (FQDN)!');
                    }
                }
                /**
                function testVBusIOFormat(config) {
                    if (!config.vbusViaTag.match(vbusioformat)) {
                        reject('VBusIO-Format is invalid! Should be something like [d01234567890.vbus.io] or [d01234567890.vbus.net].');
                    }
                }
                **/
                function testPassword(config) {
                    if (!config.vbusPassword || '' === config.vbusPassword) {
                        reject('Password is missing!');
                    }
                }

                function testPort(config) {
                    if ('' === config.connectionPort || 0 === config.connectionPort) {
                        reject('Invalid connection port given! Should be > 0.');
                    }
                }

                function testChannel(config) {
                    if (config.vbusChannel < 1 || config.vbusChannel >= 7) {
                        reject('Invalid DL3 channel given! Should be between 1 and 6.');
                    }
                }

                // switch connectionDevice seleted by User
                if (config.connectionDevice === 'serial') {
                    testSerialformat(config);
                    resolve('Config seems to be valid for USB/Serial.');
                } else if (config.connectionDevice === 'lan') {
                    testIP_and_FQDN_Format(config);
                    testPassword(config);
                    testPort(config);
                    resolve('Config seems to be valid for LAN.');
                } else if (config.connectionDevice === 'langw') {
                    testIP_and_FQDN_Format(config);
                    testPort(config);
                    resolve('Config seems to be valid for Serial-to-LAN-Gateway.');
                } else if (config.connectionDevice === 'dl2') {
                    testIP_and_FQDN_Format(config);
                    testPort(config);
                    testPassword(config);
                    resolve('Config seems to be valid for KM2/DL2.');
                } else if (config.connectionDevice === 'dl3') {
                    testIP_and_FQDN_Format(config);
                    testPort(config);
                    testPassword(config);
                    testChannel(config);
                    resolve('Config seems to be valid for DL3/DL2Plus.');
                    /**
                } else if (config.connectionDevice === 'inet') {
                    testPort(config);
                    testVBusIOFormat(config);
                    testPassword(config);
                    resolve('Config seems to be valid for KM2/DL2/DL3 via VBus.net.');
**/
                } else {
                    reject('Config is invalid! Please select at least a connection device to get further tests - or even better, complete your whole config.');
                }
            }
        );
    }
    


    // Is called when databases are connected and adapter received configuration.
    async onReady() {
        this.configIsValid(this.config)
            .then(result => {
                this.log.info(result);
                this.main().then(null, err => {
                    this.log.error(err);
                    this.setState('info.connection', false, true);
                });
            })
            .catch(err => {
                this.log.error(err);
                this.setStateAsync('info.connection', false, true);
                return;
                //this.terminate('Terminating Adapter until Configuration is completed', 11);
            });

        /**     
        try {
            // Terminate adapter after first start because configuration is not yet received
            // Adapter is restarted automatically when config page is closed
            if (this.config.connectionDevice  !== '') {
                await this.main();
            } else {
                await this.setStateAsync('info.connection', false, true);
                this.terminate('Terminate Adapter until Configuration is completed', 11);
                //throw new Error ('Terminate Adapter until Configuration is completed');
            }
        } catch (error) {
            this.log.error(`[onReady] error: ${error.message}, stack: ${error.stack}`);
        } 
        **/
        
    }

    //  Create or extend object
    createOrExtendObject(id, objData, value) {
        const self = this;
        this.getObject(id, function (err, oldObj) {
            if (!err && oldObj) {
                self.extendObject(id, objData, () => {self.setState(id, value, true);});
            } else {
                self.setObjectNotExists(id, objData, () => {self.setState(id, value, true);});
            }
        });
    }

    // Exit adapter 
    onUnload(callback) {
        try {
            ctx.connection.disconnect();
            this.log.info('Cleaned up everything...');
            callback();
        } catch (e) {
            callback();
        }
    }
}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new MyVbus(options);
} else {
    // otherwise start the instance directly
    new MyVbus();
}

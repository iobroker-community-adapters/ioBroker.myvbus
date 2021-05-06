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
    headerSet: vbus.HeaderSet(),
    hsc: vbus.HeaderSetConsolidator(),
    connection: vbus.Connection()
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
            await this.getForeignObjectAsync('system.config').then(sysConf => {
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
            }).catch(err => {
                this.log.error(JSON.stringify(err));
            });

            const spec = new vbus.Specification({
                language: language
            });
            // The adapters config (in the instance object everything under the attribute "native") is accessible via
            // this.config:
            const connectionDevice = this.config.connectionDevice;
            const connectionIdentifier = this.config.connectionIdentifier;
            const connectionPort = this.config.connectionPort;
            let vbusPassword = this.config.vbusPassword;
            const vbusChannel = this.config.vbusChannel;
            const vbusDataOnly = this.config.vbusDataOnly;
            const vbusViaTag = this.config.vbusViaTag;
            const vbusInterval = this.config.vbusInterval;

            this.log.debug(`Language: ${language}`);
            this.log.debug(`Connection Type: ${connectionDevice}`);
            this.log.debug(`Connection Identifier: ${connectionIdentifier}`);
            this.log.debug(`Connection Port: ${connectionPort}`);
            this.log.debug(`VBus Password encrypted: ${vbusPassword}`);
            this.log.debug(`VBus Channel: ${vbusChannel}`);
            this.log.debug(`VBus Via Tag: ${vbusViaTag}`);
            this.log.debug(`VBus Interval: ${vbusInterval}`);

            // Check if credentials are not empty and decrypt stored password
            if (!(connectionDevice==='serial' || connectionDevice==='langw')) {
                if (vbusPassword && vbusPassword !== '')  {
                    await this.getForeignObjectAsync('system.config').then(obj => {
                        if (obj && obj.native && obj.native.secret) {
                        //noinspection JSUnresolvedVariable
                            vbusPassword = this.decrypt(obj.native.secret, vbusPassword);
                        } else {
                        //noinspection JSUnresolvedVariable
                            vbusPassword = this.decrypt('Zgfr56gFe87jJOM', vbusPassword);
                        }
                    }).catch(err => {
                        this.log.error(JSON.stringify(err));
                    });

                } else {
                    this.log.error('[Credentials] error: Password missing or empty in Adapter Settings');
                }
            }

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
                        this.log.warn('Host-address not valid. Should be IP-address or FQDN');
                    }
                    break;

                case 'serial':
                    if (connectionIdentifier.match(serialformat)) {
                        ctx.connection = new vbus.SerialConnection({
                            path: connectionIdentifier
                        });
                        this.log.info('Serial Connection at ' + connectionIdentifier + ' selected');
                    } else {
                        this.log.warn('Serial port ID not valid. Should be like /dev/tty.usbserial or COM9');
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
                        this.log.warn('Host-address not valid. Should be IP-address or FQDN');
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
                        this.log.warn('Host-address not valid. Should be IP-address or FQDN');
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
                        this.log.warn('Host-address not valid. Should be IP-address or FQDN');
                    }
            }

            // Connection state handler
            ctx.connection.on('connectionState', (connectionState) => {
                this.log.debug('Connection state changed to ' + connectionState);
                if (connectionState === 'CONNECTED') {
                    this.log.info('Connection established');
                    await this.setStateAsync('info.connection', true, true);
                } else {
                    await this.setStateAsync('info.connection', false, true);
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
                interval: vbusInterval * 1000,
                timeToLive: (vbusInterval * 1000) + 1000
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

                this.log.debug('received data: ' + JSON.stringify(data));
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
                    this.log.debug('received item-data: ' + JSON.stringify(item));
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
                            common.min = -100;
                            common.max = +300;
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
            this.log.info('Wait for Connection...');
            await ctx.connection.connect();
            ctx.hsc.startTimer();
                   
        } catch (error) {
            this.log.error(`[main()] error: ${error.message}, stack: ${error.stack}`);
        }
    }

    // Is called when databases are connected and adapter received configuration.
    async onReady() {
        try {
            // Terminate adapter after first start because configuration is not yet received
            // Adapter is restarted automatically when config page is closed
            if (this.config.connectionDevice  !== '') {
                await this.main();
            } else {
                await this.setStateAsync('info.connection', false, true);
                this.terminate('Terminate Adapter until Configuration is completed', 11);
            }
        } catch (error) {
            this.log.error(`[onReady] error: ${error.message}, stack: ${error.stack}`);
        }
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
    
    // Decrypt passwords
    decrypt(key, value) {
        let result = '';
        for (let i = 0; i < value.length; ++i) {
            result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
        }
        return result;
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

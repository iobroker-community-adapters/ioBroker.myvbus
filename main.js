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
const spec = vbus.Specification.getDefaultSpecification();
const ctx = {
    headerSet: vbus.headerSet,
    hsc: vbus.HeaderSetConsolidator,
    connection: vbus.connection,
};

class MyVbus extends utils.Adapter {

    /**
     * @param {Partial<ioBroker.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'myvbus',
        });
        this.on('ready', this.onReady.bind(this));
        //this.on('objectChange', this.onObjectChange.bind(this));
        //this.on('stateChange', this.onStateChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    // Is called when databases are connected and adapter received configuration.
    async onReady() {
        // Initialize adapter here
        // Reset the connection indicator during startup
        this.setState('info.connection', false, true);
        const self = this; 
        const connectionType = this.config.connectionType;
        const connectionIdentifier = this.config.connectionIdentifier;
        const connectionPort = this.config.connectionPort;
        const vbusPassword = this.config.vbusPassword;
        const vbusChannel = this.config.vbusChannel;
        const vbusDataOnly = this.config.vbusDataOnly;
        const vbusViaTag = this.config.vbusViaTag;
        const vbusInterval = this.config.vbusInterval;
        let forceReInit = this.config.forceReInit; 

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:
        this.log.info('Connection Type: ' + connectionType);
        this.log.info('Connection Identifier: ' + connectionIdentifier);
        this.log.info('VBus Password: ' + vbusPassword);
        this.log.info('VBus Channel: ' + vbusChannel);
        this.log.info('VBus Via Tag: ' + vbusViaTag);
        this.log.info('VBus Interval: ' + vbusInterval);
        this.log.info('Force ReInit: ' + forceReInit);

        // in this vbus adapter all states changes inside the adapters namespace are subscribed
        this.subscribeStates('*');
           
        ctx.headerSet = new vbus.HeaderSet();
        let ConnectionClass = vbus.ConnectionClass;
        const ipformat = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        const serialformat = /^(COM|com)[0-9][0-9]?$|^\/dev\/tty.*$/;
        const vbusioformat = /.vbus.io$/;
        const urlformat = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/;
        ctx.hsc = new vbus.HeaderSetConsolidator({
            interval: vbusInterval * 1000,
            timeToLive: (vbusInterval * 1000) + 1000,
        });
        if (connectionType == 'lan') {
            if (connectionIdentifier.match(ipformat)) {
                ConnectionClass = vbus['TcpConnection'];
                ctx.connection = new ConnectionClass({
                    host: connectionIdentifier,
                    port: connectionPort,
                    password: vbusPassword
                });
                self.log.info('TCP Connection established');
            } else { 
                self.log.warn('IP-address not valid. Should be xxx.xxx.xxx.xxx.');
            }
        } else if (connectionType == 'serial' ) {
            if (connectionIdentifier.match(serialformat)) {
                ConnectionClass = vbus['SerialConnection'];
                ctx.connection = new ConnectionClass({
                    path: connectionIdentifier
                });
                self.log.info('Serial Connection established');
            } else { 
                self.log.warn('Serial port ID not valid. Should be like /dev/tty.usbserial or COM9');
            }
        } else if (connectionType == 'langw') {
            if (connectionIdentifier.match(ipformat)) {
                ConnectionClass = vbus['TcpConnection'];
                ctx.connection = new ConnectionClass({
                    host: connectionIdentifier,
                    rawVBusDataOnly: vbusDataOnly            
                });
                self.log.info('TCP Connection established');
            } else { 
                self.log.warn('IP-address not valid. Should be xxx.xxx.xxx.xxx.');
            }
        } else if (connectionType == 'dl2') {
            if (connectionIdentifier.match(urlformat)) {
                if (connectionIdentifier.match(vbusioformat)) {
                    ConnectionClass = vbus['TcpConnection'];
                    ctx.connection = new ConnectionClass({
                        host: connectionIdentifier,
                        password: vbusPassword
                    });
                    self.log.info('TCP Connection established');
                } else { 
                    ConnectionClass = vbus['TcpConnection'];
                    ctx.connection = new ConnectionClass({
                        host: connectionIdentifier,
                        password: vbusPassword,
                        viaTag: vbusViaTag
                    });
                }
            } else {
                self.log.warn('url not valid.');
            }
        } else if (connectionType == 'dl3') {
            if (connectionIdentifier.match(urlformat)) {
                if (connectionIdentifier.match(vbusioformat)) {
                    ConnectionClass = vbus['TcpConnection'];
                    ctx.connection = new ConnectionClass({
                        host: connectionIdentifier,
                        password: vbusPassword,
                        channel: vbusChannel
                    });
                    self.log.info('TCP Connection established');
                } else { 
                    ConnectionClass = vbus['TcpConnection'];
                    ctx.connection = new ConnectionClass({
                        host: connectionIdentifier,
                        password: vbusPassword,
                        viaTag: vbusViaTag,
                        channel: vbusChannel
                    });
                }
            } else {
                self.log.warn('url not valid.');
            }
        }
        await ctx.connection.connect();
        ctx.hsc.startTimer();

        ctx.connection.on('packet', function (packet) {
            ctx.headerSet.removeAllHeaders();
            ctx.headerSet.addHeader(packet);
            ctx.hsc.addHeader(packet);
            // Packet received
            //self.log.debug('Packet received');
            self.setState('info.connection', true, true);
            if (forceReInit) {
                ctx.hsc.emit('headerSet', ctx.hsc);
            }
        });

        ctx.hsc.on('headerSet', function (headerSet) {
            const packetFields = spec.getPacketFieldsForHeaders(ctx.headerSet.getSortedHeaders());
            const data = _.map(packetFields, function (pf) {
                return {
                    id: pf.id,
                    name: pf.name,
                    value: pf.rawValue,
                    deviceName: pf.packetSpec.sourceDevice.fullName,
                    deviceId: pf.packetSpec.sourceDevice.deviceId,
                    addressId: pf.packetSpec.sourceDevice.selfAddress,
                    unitId: pf.packetFieldSpec.type.unit.unitId,
                    unitText: pf.packetFieldSpec.type.unit.unitText,
                    typeId: pf.packetFieldSpec.type.typeId,
                    rootTypeId: pf.packetFieldSpec.type.rootTypeId
                };
            });
            self.log.debug('Headerset Event occurred');
            _.forEach(data, function (item) {
                const deviceId = item.deviceId.replace(/_/g, '');
                const channelId = deviceId + '.' + item.addressId;
                const objectId = channelId + '.' + item.id.replace(/_/g, '');

                if (forceReInit) {
                    initDevice(deviceId, channelId, objectId, item);
                }
                self.setState(objectId, item.value, true);
            });

            if (forceReInit) {
                self.extendForeignObject('system.adapter.' + self.namespace, {
                    native: {
                        forceReInit: false
                    }
                });
                forceReInit = false;
            }
        });

        async function initDevice(deviceId, channelId, objectId, item) {
            await self.setObjectNotExistsAsync(deviceId, {
                type: 'device',
                common: {
                    name: item.deviceName
                },
                native: {}
            });
            await self.setObjectNotExistsAsync(channelId, {
                type: 'channel',
                common: {
                    name: channelId
                },
                native: {}
            });
            const common = {
                name: item.name,
                type: 'number',
                unit: item.unitText,
                read: true,
                write: false
            };
            switch (item.unitId) {
                case 'DegreesCelsius':
                    common.min = -100;
                    common.max = +300;
                    common.role = 'value.temperature';
                    break;
                case 'Percent':
                    common.min = 0;
                    common.max = 100;
                    common.role = 'value.volume';
                    break;
                case 'Hours':
                    common.role = 'value';
                    break;
                case 'WattHours':
                    common.role = 'value.power.consumption';
                    break;
                case 'None':
                    common.role = 'value';
                    break;
                default:
                    break;
            }
            await self.setObjectNotExistsAsync(objectId, {
                type: 'state',
                common: common,
                native: {}
            });
        }

    }
  
    onUnload (callback) {
        try {
            ctx.connection.disconnect();
            this.setState('info.connection', false, true);
            this.log.info('cleaned everything up...');
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
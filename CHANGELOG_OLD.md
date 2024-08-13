# Older changes
## 0.2.2 (2022-02-11)

* Updated dependencies
* Compatibility check for js-controller 4.0
* Support for js-controller 1.x dropped

## 0.2.1 (2021-08-18)

* Update dependencies
* Changed allowed range of temperature values to include the error values for short circuit and open circuit

## 0.2.0 (2021-06-25)

* Dropped node.js 10 support, added node.js 14 and 16 support

## 0.1.1 (2021-05-18)

* Fixes for supporting js-controller >=3.2.x

## 0.1.0

* (grizzelbee) Fix: config page shows current settings now (not default anymore)
* (grizzelbee) Fix: "Connected" state is updated correctly now if connection is disrupted.
* (grizzelbee) New: Added Badge for latest(npm) version to readme
* (grizzelbee) Fix: removed default password from config to ensure it's encrypted on first config
* (grizzelbee) Fix: removed Force-ReInit
* (grizzelbee) Fix: sensor maintenance indicators are booleans now
* (grizzelbee) New: added activity indicator states for relays
* (pdbjjens) Fix: Prevent warnings regarding non-existent objects upon adapter instance creation and start-up with js-controller 3.2.x
* (pdbjjens) Fix: updated dependencies and vulnerabilities

## 0.0.6
* (pdbjjens) alpha 6 release updated dependencies

## 0.0.5
* (pdbjjens) alpha 5 release improved type and role mapping of adapter values

## 0.0.4
* (pdbjjens) alpha 4 release updated dependency on resol-vbus library to 0.21.0

## 0.0.3
* (pdbjjens) alpha 3 release tested with DL3 over local LAN and VBus.net and DeltaSol SLT (0x1001) incl. HQM (0x1011)

## 0.0.2
* (pdbjjens) alpha 2 release tested with VBus/LAN, KM2, VBus.net and DeltaSol E (0x7721 & 0x7722), DeltaSol M (0x7311 & 0x716), DeltaSol CS Plus (0x2211), Oventrop RQXXL (0x7541)

## 0.0.1

* (pdbjjens) initial release tested only with VBus/USB (Serial) and DeltaSol(R) BS2009 (0x427B)

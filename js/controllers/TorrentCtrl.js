angular.module('DuckieTorrent.controllers', ['DuckieTorrent.torrent', 'DuckieTV.providers.chromecast'])


.controller('TorrentCtrl',
    function($scope, $rootScope, uTorrent, $q, DuckieTVCast) {
        $scope.ports = [];
        $scope.statusLog = [];
        $scope.session = false;
        $scope.authToken = localStorage.getItem('utorrent.token')
        uTorrent.setPort(localStorage.getItem('utorrent.port'));
        $scope.rpc = null;
        $scope.polling = false;
        /**
         * A btapp api runs on one of these ports
         */

        $scope.isFormatSupported = function(file) {
            return ['p3', 'aac', 'mp4', 'ogg', 'mkv'].indexOf(file.name.split('.').pop()) > -1;
        }

        $scope.playInBrowser = function(torrent) {
            $rootScope.$broadcast('video:load', torrent.properties.all.streaming_url.replace('://', '://admin:admin@').replace('127.0.0.1', $rootScope.getSetting('ChromeCast.localIpAddress')));
        }

        function get_port(i) {
            return 7 * Math.pow(i, 3) + 3 * Math.pow(i, 2) + 5 * i + 10000;
        }

        $scope.Cast = function() {
            console.log('connecting!');
            DuckieTVCast.initialize();
        }

        /**
         * Execute a portscan on any of the 20 ports that are generated by the get_port api until one works.
         * If it works, store it in uTorrent.port
         */
        $scope.Scan = function() {
            var ports = [];
            for (var i = 0; i < 20; i++) {
                ports.push(get_port(i));
            }
            uTorrent.portScan(ports).then(function(result) {
                $scope.statusLog.push('Ping result on port', result.port);
                $scope.statusLog.push(angular.toJson(result.version, true))
                console.log("Ping result on port", result);
                localStorage.setItem('utorrent.port', result.port);

                uTorrent.setPort(result.port);
            }, function(err) {
                console.error('Could not connect to one of the ports!');
            })
        }

        /**
         * Connect with an auth token obtained by the Pair function.
         * Store the resulting session key in $scope.session
         */
        $scope.Connect = function() {
            uTorrent.connect(localStorage.getItem('utorrent.token')).then(function(result) {
                $scope.statusLog.push('to session ' + result.session);
                $scope.session = result.session;
                $scope.rpc = uTorrent.getRemote();
            });
        }

        /**
         * Execute a pair promise against utorrent
         * It waits 30 seconds for the promise to timeout.
         * When it works, it stores the returned auth token for connecting with the Connect function
         */
        $scope.Pair = function() {
            uTorrent.pair().then(function(result) {
                console.log("Received auth token!", result);
                localStorage.setItem('utorrent.token', result);
                $scope.authToken = result;
            }, function(err) {
                console.error("Eror pairing!", err);
            })
        }

        $scope.togglePolling = function() {
            $scope.polling = !$scope.polling;
            $scope.Update();
        }
        /**
         * Start the status update polling.
         * Stores the resulting TorrentClient service in $scope.rpc
         * Starts polling every 1s.
         */
        $scope.Update = function() {
            if ($scope.polling == true) {
                uTorrent.statusQuery().then(function(data) {
                    if ($scope.polling) setTimeout($scope.Update, data.length == 0 ? 3000 : 0); // burst when more data comes in, delay when things ease up.
                });
            }
        }


        discoverLocalIP = function() {
            console.log("Discover local IP! ");
            var p = $q.defer();

            var RTCPeerConnection = window.webkitRTCPeerConnection;
            var addrs = {};

            var rtc = new RTCPeerConnection({
                iceServers: []
            });
            if (window.mozRTCPeerConnection) rtc.createDataChannel('', {
                reliable: false
            });

            function grepSDP(sdp) {
                var hosts = [];
                sdp.split('\r\n').map(function(line) {
                    if (~line.indexOf('a=candidate')) {
                        var parts = line.split(' '),
                            addr = parts[4],
                            type = parts[7];
                        if (type === 'host') addrs[addr] = true;
                    } else if (~line.indexOf('c=')) {
                        //  var parts = line.split(' '),
                        //     addr = parts[2];
                        //  addrs[addr] = true;
                    }
                });
            }

            rtc.onicecandidate = function(evt) {
                if (evt.candidate) {
                    grepSDP(evt.candidate.candidate);
                }
            }

            rtc.createOffer(function(desc) {
                rtc.setLocalDescription(desc)
            }, function(e) {});

            setTimeout(function() {
                p.resolve(Object.keys(addrs));
            }, 1500);

            return p.promise;

        }

        $scope.getLocalIP = function() {
            discoverLocalIP().then(function(result) {
                console.debug("Local IP Address: ", result);
                $scope.localIpAddresses = result;
            });
        };

        $scope.localIpAddress = $rootScope.getSetting('ChromeCast.localIpAddress');

        $scope.setStreamingSource = function(address) {
            $rootScope.setSetting('ChromeCast.localIpAddress', address);
            $scope.localIpAddress = address;
        }


    })




function go() {
    enumLocalIPs(function(localIp) {
        document.getElementById('localips').innerHTML += localIp + '<br>';
    });
}
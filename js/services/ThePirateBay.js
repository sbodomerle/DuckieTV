angular.module('DuckieTV.providers.thepiratebay', [])
/**
 * Autofill serie search component
 * Provides autofill proxy and adds the selected serie back to the MainController
 */
.controller('FindTPBTypeAheadCtrl', function($scope, ThePirateBay) {

    $scope.selected = undefined;
    $scope.search = function(serie) {
        return ThePirateBay.search(serie).then(function(res) {
            return res;
        });
    };
    $scope.selectSerie = function(serie) {
        $scope.selected = serie.name;
        console.log("Serie selected!", serie);
    }
})
/**
 * ThePirateBay provider
 * Allows searching for any content on tpb, ordered by most seeds
 */
.provider('ThePirateBay', function() {

    this.mirror = null;
    this.endpoints = {
        search: '/search/%s/0/7/0',
        details: '/torrent/%s',
    };

    /**
     * Switch between search and details
     */
    this.getUrl = function(type, param) {
        return this.mirror + this.endpoints[type].replace('%s', encodeURIComponent(param));
    },

    this.parseSearch = function(result) {
        var parser = new DOMParser();
        var doc = parser.parseFromString(result.data, "text/html");
        var results = doc.querySelectorAll("#searchResult tbody tr");
        var output = [];
        for (var i = 0; i < results.length; i++) {
            var out = {
                releasename: results[i].querySelector('td:nth-child(2) > div ').innerText.trim(),
                magneturl: results[i].querySelector('td:nth-child(2) > a').href,
                size: results[i].querySelector('td:nth-child(2) .detDesc').innerText.split(', ')[1].split(' ')[1],
                seeders: results[i].querySelector("td:nth-child(3)").innerHTML,
                leechers: results[i].querySelector("td:nth-child(4)").innerHTML
            };
            out.torrent = 'http://torcache.net/torrent/' + out.magneturl.match(/([0-9ABCDEFabcdef]{40})/)[0].toUpperCase() + '.torrent?title=' + encodeURIComponent(out.releasename.trim());
            output.push(out);
        }
        console.log("parsed: ", output);
        return output;
    }

    /**
     * Get wrapper, providing the actual search functions and result parser
     * Provides promises so it can be used in typeahead as well as in the rest of the app
     */
    this.$get = function($q, $http, MirrorResolver, SettingsService) {
        var self = this;
        self.mirror = SettingsService.get('thepiratebay.mirror');
        self.activeRequest = null;
        return {
            /**
             * Execute a generic tpb search, parse the results and return them as an array
             */
            search: function(what) {
                var d = $q.defer();
                if (self.activeRequest) self.activeRequest.resolve();
                self.activeRequest = $q.defer();
                $http({
                    method: 'GET',
                    url: self.getUrl('search', what),
                    cache: true,
                    timeout: self.activeRequest.promise
                }).then(function(response) {
                    console.log("TPB search executed!", response);
                    d.resolve(self.parseSearch(response));
                }, function(err) {
                    if (err.status > 300) {
                        MirrorResolver.findTPBMirror().then(function(result) {
                            console.log("Resolved a new working mirror!", result);
                            self.mirror = result;
                            return d.resolve(self.$get($q, $http, MirrorResolver).search(what));
                        }, function(err) {
                            console.debug("Could not find a working TPB mirror!", err);
                            d.reject(err);
                        })
                    }
                });
                return d.promise;
            },
            /**
             * Fetch details for a specific tpb torrent id
             */
            torrentDetails: function(id) {
                var d = $q.defer();
                $http({
                    method: 'GET',
                    url: self.getUrl('details', id),
                    cache: true
                }).success(function(response) {
                    d.resolve({
                        result: self.parseDetails(response)
                    });
                }).error(function(err) {
                    d.reject(err);
                });
                return d.promise;
            }
        }
    }
})
    .directive('piratebaySearch', function() {

        return {
            restrict: 'E',
            template: ['<div ng-controller="FindTPBTypeAheadCtrl">',
                '<input type="text" ng-model="selected" placeholder="Search for anything on The Pirate Bay" typeahead-min-length="2" typeahead-loading="loadingTPB"',
                'typeahead="result for results in search($viewValue)" typeahead-template-url="templates/typeAheadTPB.html"',
                'typeahead-on-select="selectTPBItem($item)" class="form-control"> <i ng-show="loadingTPB" class="glyphicon glyphicon-refresh"></i>',
                '</div>'
            ].join(' ')
        };
    })
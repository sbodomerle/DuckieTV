angular.module('DuckieTV.providers.thetvdb', [])
    .provider('TheTVDB', function() {

        this.endpoints = {
            seriesSearch: 'http://thetvdb.com/api/GetSeries.php?seriesname=%s',
            episodeSearch: 'http://thetvdb.com/api/646990DA07A98A2B/series/%s/all/en.xml'
        };

        this.getUrl = function(type, seriesname) {
            return this.endpoints[type + 'Search'].replace('%s', encodeURIComponent(seriesname));
        },

        this.parseEpisodes = function(data) {
            var curDate = new Date().getTime();
            var epis = angular.element(data).find("Episode");
            var data = [];
            for (var i = epis.length - 1; i > 0; i--) {
                var episode = angular.element(epis[i]);
                var properties = episode.find("*")
                var props = {};
                for (var j = 0; j < properties.length; j++) {
                    props[properties[j].localName] = properties[j].innerText;
                }
                if (!('airsbefore_episode' in props) && props['seasonnumber'].length != 4) { // do not add double episodes and do not add episodes when there's seasonnumbers of 4 digits (like in pawn stars)
                    data.push(props);
                }
            }
            return data;
        }

        this.parseSeries = function(data) {
            var searchresults = [];
            var series = angular.element(typeof(data) == 'string' ? data : data.xml).find('Series'); // to accomodate parsing series from within episode search as well
            for (var i = 0; i < series.length; i++) {
                var serie = angular.element(series[i]);
                var banner = serie.find('banner').text();
                var data = {
                    id: serie.find("id").text(),
                    escaped: serie.find("SeriesName").text().replace(/\'/g, "\'"),
                    banner: banner !== '' ? "http://thetvdb.com/banners/" + banner : "",
                    name: serie.find("SeriesName").text(),
                    overview: serie.find("Overview").text()
                };
                var properties = serie.find("*")
                var props = {};
                for (var j = 0; j < properties.length; j++) {
                    if (!(properties[j].localName in data)) {
                        data[properties[j].localName.toLowerCase()] = properties[j].innerText;
                    }
                }
                searchresults.push(data)
            }
            return searchresults;
        }


        this.$get = function($q, $http) {
            var self = this;
            return {
                findSeries: function(name) {
                    var d = $q.defer();
                    $http({
                        method: 'GET',
                        url: self.getUrl('series', name),
                        cache: true
                    }).then(function(response) {
                        d.resolve({
                            series: self.parseSeries(response)
                        });
                    }, function(err) {
                        console.log('error!');
                        d.reject(err);
                    });
                    return d.promise;
                },
                findEpisodes: function(seriesID) {
                    var d = $q.defer();
                    $http({
                        method: 'GET',
                        url: self.getUrl('episode', seriesID),
                        cache: true
                    }).success(function(response) {
                        d.resolve({
                            serie: self.parseSeries(response)[0],
                            episodes: self.parseEpisodes(response)
                        });
                    }).error(function(err) {
                        d.reject(err);
                    });
                    return d.promise;
                }
            }
        }
    })
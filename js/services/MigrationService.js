angular.module('DuckieTV.providers.migrations', ['DuckieTV.providers.favorites', 'DuckieTV.providers.trakttv', 'dialogs.services'])
    .factory('MigrationService', function($rootScope, FavoritesService, TraktTV, $dialogs, $q) {

        var addFave = function(TVDB_ID, watched) {
            console.log("Add fave: ", TVDB_ID, watched)
            var p = $q.defer();
            $rootScope.$broadcast('dialogs.wait.progress', {
                'header': 'Please wait while updating database',
                'progress': (100 / howmany) * (done + 0.2),
                'msg': "Resolving show " + TVDB_ID
            });
            TraktTV.enableBatchMode().findSerieByTVDBID(TVDB_ID).then(function(serie) {
                $rootScope.$broadcast('dialogs.wait.progress', {
                    'header': 'Please wait while updating database',
                    'progress': (100 / howmany) * (done + 0.6),
                    'msg': "Show found: " + serie.title + ". Updating information. "
                });
                FavoritesService.addFavorite(serie, watched).then(function() {
                    addDone();
                    $rootScope.$broadcast('dialogs.wait.progress', {
                        header: 'Please wait while updating database',
                        'progress': (100 / howmany) * done,
                        'msg': "Updating: " + serie.title
                    });
                    $rootScope.$broadcast('favorites:updated');
                    p.resolve();
                }, function() {
                    p.reject();
                });
            });
            return p.promise;
        };

        var done = 1;
        var homany = 0;
        var addDone = function() {
            done = done + 1;
        }
        var isDone = function() {
            console.log('is done? ', done, howmany);
            return done > howmany;
        }

            function migrateFromTVDB() {
                var out = {
                    settings: {},
                    series: {}
                };

                var dlg = $dialogs.wait('Please wait while updating database', 'one-time database upgrade in progress', 0);

                CRUD.EntityManager.getAdapter().db.execute('select Series.TVDB_ID from Series').then(function(series) {
                    var out = {
                        settings: {},
                        series: {}
                    };
                    var pq = [];
                    while (serie = series.next()) {
                        out.series[serie.get('TVDB_ID')] = [];
                    }
                    CRUD.EntityManager.getAdapter().db.execute('select Series.TVDB_ID, Episodes.TVDB_ID as epTVDB_ID, Episodes.watchedAt from Series left join Episodes on Episodes.ID_Serie = Series.ID_Serie where Episodes.watchedAt is not null').then(function(res) {
                        while (row = res.next()) {
                            if (!out.series[row.get('TVDB_ID')]) {
                                out.series[row.get('TVDB_ID')] = [];
                            }
                            out.series[row.get('TVDB_ID')].push({
                                'TVDB_ID': row.get('epTVDB_ID'),
                                'watchedAt': new Date(row.get('watchedAt')).getTime()
                            })
                        }
                        howmany = Object.keys(out.series).length;
                        if (howmany == 0) {
                            localStorage.setItem('0.4migration', 'done');
                        }
                        var p = false;
                        angular.forEach(out.series, function(watched, TVDB_ID) {
                            pq.push(addFave(TVDB_ID, watched));
                        });
                        $q.all(pq).then(function(res) {
                            $rootScope.$broadcast('dialogs.wait.message', "All series processed!");
                            if (isDone()) {
                                $rootScope.$broadcast('favorites:updated', FavoritesService);
                                $rootScope.$broadcast('dialogs.wait.complete');
                                localStorage.setItem('0.4migration', 'done');
                            }
                        });
                    });

                });

            }

        var orphanCheck = function() {
            CRUD.EntityManager.getAdapter().db.execute('select Series.name from Series').then(function(series) {
                var checklist = [];

                while (serie = series.next()) {
                    checklist.push(serie.get('name') + ' update check');
                }

                chrome.alarms.getAll(function(result) {
                    var notexisting = result.filter(function(el) {
                        return checklist.indexOf(el.name) == -1;
                    })
                    notexisting.map(function(el) {
                        chrome.alarms.clear(el.name);
                        CRUD.FindOne('ScheduledEvent', {
                            name: el.name
                        }).then(function(el) {
                            console.log("Deleting scheduled event!", el);
                            el.Delete();

                        })
                    })
                    localStorage.setItem('0.42.orphancheck', 'done');
                });
            })
        }

        var service = {

            check: function() {

                if (!localStorage.getItem('0.4migration')) {
                    migrateFromTVDB();
                }
                if (!localStorage.getItem('0.42orphancheck')) {
                    console.log('orphan check needs to run!');
                    orphanCheck();
                }
            }
        };

        return service;



    })
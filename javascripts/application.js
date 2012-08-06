jQuery(function() {
    var HTML5_MEDIA_EVENTS = [
        "readystatechange",
        "stalled",
        "durationchange",
        "loadstart",
        "abort",
        "loadedmetadata",
        "error",
        "canplay",
        "progress",
        "seek",
        "seeked",
        "ended",
        "pause",
        "play",
        "suspend"
    ];

    var HTML5_ERROR_CODES = {
        1: 'MEDIA_ERR_ABORTED',
        2: 'MEDIA_ERR_NETWORK',
        3: 'MEDIA_ERR_DECODE',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
    };

    var SUPPORTED_VIDEO_EXTENSIONS = [
         'mp4', 'avi', 'mkv', 'mov'
    ];

    var SUPPORTED_AUDIO_EXTENSIONS = [
        'mp3'
    ];

    var STATUS_MESSAGES = {
        'plugin:plugin_installed': 'plugin installed',
        'plugin:plugin_running': 'plugin running',
        'plugin:client_installed': 'client installed',
        'plugin:client_running': 'client running',
        'client:connected': 'client connecting',
        'client:disconnected': 'client disconnected',
        'sync': 'client connected',
        'client:error': 'error',
        'input:creating_torrent': 'creating torrent',
        'input:torrent_created': 'torrent created',
        'input:redirecting': 'redirecting',
        'input:waiting_for_folder_selection': 'waiting for selection',
        'input:no_files_selected': 'no files selected'
    };

    var TRACKERS = [
        'udp://tracker.openbittorrent.com:80/announce',
        'udp://tracker.publicbt.com:80/announce',
        'http://bt.rghost.net/announce',
        'http://exodus.desync.com/announce',
        'http://tracker.ccc.de/announce',
        'http://tracker.publichd.eu/announce',
        'http://tracker.torrentbay.to:6969/announce',
        'http://tracker.yify-torrents.com/announce',
        'udp://ipv4.tracker.harry.lu:80/announce',
        'udp://tracker.ccc.de/announce',
        'udp://tracker.ccc.de:80/announce',
        'udp://tracker.djhsearch.co.cc:80/announce',
    ];    

    function isInfoHash(hash) {
        return typeof hash === 'string' && hash.length === 40;
    }

    function isMagnetLink(hash) {
        return hash.indexOf('magnet:?') !== -1;

    }

    function getMagnetLink(hash) {
        var link = 'magnet:?xt=urn:btih:' + hash;
        _.each(TRACKERS, function(tracker) {
            link += '&tr=' + tracker;
        });
        return link;
    }

    function create_torrent_filename(arg) {
        var paths = typeof arg === 'string' ? [arg] : arg;
        var default_path, filename;
        default_path = paths[0];
        filename = filename_from_filepath(default_path);
        if (paths.length > 1) {
            return remove_extension(filename) + '_and_others';
        } else {
            return filename;
        }
    }

    function remove_extension(filename) {
        var nameArray;
        nameArray = filename.split('.');
        if (nameArray.length > 1) {
            return _.first(nameArray, nameArray.length - 1).join('.');
        } else {
            return nameArray[0];
        }
    }

    function filename_from_filepath(filepath) {
        var filename;
        filename = _.last(filepath.split('\\'));
        return _.last(filename.split('/'));
    }

    function readableFileSize(size) {
        var units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        var i = 0;
        while(size >= 1024) {
            size /= 1024;
            ++i;
        }
        return size.toFixed(1) + ' ' + units[i];
    }

    function readableTransferRate(rate) {
        return readableFileSize(rate) + '/s';
    }

    var AppView = Backbone.View.extend({
        className: 'main',
        initialize: function() {
            this.template = _.template($('#media_container_template').html());
            var btapp = new Btapp();

            var torrent_match = isInfoHash(hash) ? hash.toUpperCase() : '*';
            var queries = [
                ['btapp','showview'],
                ['btapp','torrent','all',torrent_match,'file','all','*','properties','all','size'],
                ['btapp','torrent','all',torrent_match,'file','all','*','properties','all','downloaded'],
                ['btapp','torrent','all',torrent_match,'file','all','*','properties','all','streaming_url'],
                ['btapp','torrent','all',torrent_match,'file','all','*','properties','all','name'],
                ['btapp','torrent','all',torrent_match,'properties','all'],
                ['btapp','torrent','all',torrent_match,'remove'],
                ['btapp','torrent','all',torrent_match,'open_containing']
            ];

            btapp.connect({
                product: this.model.get('product'),
                plugin: this.model.get('plugin'),
                pairing_type: this.model.get('pairing_type'),
                queries: queries
            });

            btapp.live('torrent ' + torrent_match + ' properties', this.torrent, this);


            var status = new Backbone.Model({
                btapp: btapp,
                product: this.model.get('product'),
                status: 'uninitialized'
            });
            var statusview = new StatusView({model: status});
            $('.toolbox').append(statusview.render().el);
        },
        render: function() {
            this.$el.html(this.template({}));
            return this;
        },
        torrent: function(properties, torrent) {
            if(!properties || typeof properties !== 'object' || typeof properties.has === 'undefined') {
                return;
            }
            var hash = this.model.get('hash');
            if( (isInfoHash(hash) && torrent.id === hash.toUpperCase()) ||
                properties.get('download_url') === hash ||
                properties.get('uri') === hash
            ) {
                this.$el.find('.media.container_background').removeClass('collapsed').addClass('expanded');

                var view = new TorrentNameView({model: torrent});
                this.$el.find('.media.container > .media_header').append(view.render().el);

                torrent.live('file * properties', this.file, this);

                var stats = new TorrentDownloadView({model: torrent});
                this.$el.find('.stats.container .wrapper').append(stats.render().el);

                var pie = new TorrentProgressIconView({model: torrent});
                pie.render();
            }
        },
        file: function(properties) {
            var name = properties.get('name');
            var ext = name.substr(name.lastIndexOf('.') + 1);
            _gaq.push(['_trackEvent', 'Extension', ext]);
            if(_.include(SUPPORTED_VIDEO_EXTENSIONS, name.substr(name.length - 3))) {
                var view = new VideoFileView({model: properties});
                this.$el.find('.media.container > .media').append(view.render().el);
            } else if(_.include(SUPPORTED_AUDIO_EXTENSIONS, name.substr(name.length - 3))) {
                var view = new AudioFileView({model: properties});
                this.$el.find('.media.container > .media').append(view.render().el);
            }
        }        
    });

    var TorrentNameView = Backbone.View.extend({
        initialize: function() {
            this.template = _.template($('#torrent_template').html());
            this.model.get('properties').on('change:name', this.render, this);
            this.model.on('destroy', this.destroy, this);
        },
        destroy: function() {
            this.model.off('change:name', this.render, this);
            this.remove();
        },
        render: function() {
            this.$el.html(this.template({
                name: this.model.get('properties').get('name')
            }));
            return this;
        }
    });

    var TorrentProgressIconView = Backbone.View.extend({
        initialize: function() {
            Piecon.setOptions({
                color: '#333', // Pie chart color
                background: '#bbb', // Empty pie chart color
                shadow: '#fff', // Outer ring color
                fallback: 'force'
            });
            this.model.get('properties').on('change:progress', this.render, this);
        },
        render: function() {
            if(this.model.has('properties')) {
                var properties = this.model.get('properties');
                if(properties.has('progress')) {
                    Piecon.setProgress(properties.get('progress') / 10.0);
                }
            }
        }
    });

    var TorrentDownloadView = Backbone.View.extend({
        initialize: function() {
            this.template = _.template($('#torrent_download_template').html());
            this.model.get('properties').on('change', this.render, this);
            this.model.on('destroy', this.destroy, this);
        },
        destroy: function() {
            this.model.off('change', this.render, this);
            this.remove();
        },
        render: function() {
            var progress = '?';
            var eta = 'Waiting for metadata';
            var files = [];
            var ratio = '?';
            var upload_speed = '?';
            var download_speed = '?';
            var seeds = '?';
            var peers = '?';

            if(this.model.has('properties')) {
                var properties = this.model.get('properties');

                if(properties.has('progress')) {
                    progress = properties.get('progress') / 10.0;

                    if(progress == 100) {
                        if(properties.has('added_on')) {
                            var date = new Date(properties.get('added_on') * 1000);
                            eta = 'Added ' + humaneDate(date);
                        }
                    } else {
                        if(properties.has('eta') && properties.get('eta') !== 0) {
                            var date = new Date(properties.get('eta') * 1000 + (new Date()).getTime());
                            eta = 'Complete In ' + humaneDate(date)
                        }
                    }

                    progress = progress + '%';
                }

                if(properties.has('download_speed')) {
                    download_speed = readableTransferRate(properties.get('download_speed'));
                }

                if(properties.has('upload_speed')) {
                    upload_speed = readableTransferRate(properties.get('upload_speed'));
                }

                if(properties.has('ratio')) {
                    ratio = properties.get('ratio') / 1000.0;
                }

                if(properties.has('peers_in_swarm')) {
                    peers = properties.get('peers_in_swarm');                    
                }

                if(properties.has('seeds_in_swarm')) {
                    seeds = properties.get('seeds_in_swarm');
                }
            }

            if(this.model.has('file')) {
                var files = this.model.get('file').map(function(file) {
                    var progress = '?';
                    var downloaded = '?';
                    var size = '?';
                    if(file.has('properties')) {
                        var fproperties  = file.get('properties');
                        if(fproperties.has('downloaded') && fproperties.has('size')) {
                            progress = 100 * fproperties.get('downloaded') / fproperties.get('size');
                            downloaded = readableFileSize(fproperties.get('downloaded'));
                            size = readableFileSize(fproperties.get('size'));
                        }
                    }
                    return {
                        progress: progress,
                        downloaded: downloaded,
                        size: size
                    };
                });
            }

            this.$el.html(this.template({
                progress: progress,
                upload_speed: upload_speed,
                download_speed: download_speed,
                eta: eta,
                files: files,
                ratio: ratio,
                seeds: seeds,
                peers: peers,
                hash: this.model.id
            }));

            this.$el.find('.icon-folder-open').click(_.bind(function(e) {
                e.preventDefault();
                this.model.open_containing();
            }, this));
            this.$el.find('.icon-remove').click(_.bind(function(e) {
                e.preventDefault();
                this.model.remove();
            }, this));

            return this;
        }
    });

    var AudioFileView = Backbone.View.extend({
        className: 'audio well',
        initialize: function() {
            this.template = _.template($('#audio_template').html());
            this.model.on('destroy', this.remove, this);
        },
        destroy: function() {
            this.model.off('destroy', this.remove, this);
            this.remove();
        },
        render: function() {
            this.$el.html(this.template({
                url: this.model.get('streaming_url'),
                name: filename_from_filepath(this.model.get('name'))
            }));
            new AudioJS(this.$el.find('audio')[0]);

            _.defer(_.bind(this.bindPlayerEvents, this));
            return this;
        },
        onPlayerEvent: function(event, data) {
            //don't track the really common ones
            if(event === 'progress' || event === 'suspend') return;
            var name = this.model.get('name');
            var ext = name.substr(name.lastIndexOf('.') + 1);
            if(event === 'error') {
                _gaq.push(['_trackEvent', ext, 'error', HTML5_ERROR_CODES[data.currentTarget.error.code]]);
                this.destroy();
            } else {
                _gaq.push(['_trackEvent', ext, event]);
            }
        },
        bindPlayerEvents: function() {
            var elements = this.$el.find('audio');
            if(elements.length > 0) {
                var audio = elements[0];
                _.each(HTML5_MEDIA_EVENTS, function(event) {
                    audio.addEventListener(event, _.bind(this.onPlayerEvent, this, event));
                }, this);
            }
        }
    });

    var VideoFileView = Backbone.View.extend({
        className: 'video well',
        initialize: function() {
            this.template = _.template($('#video_template').html());
            this.model.on('destroy', this.destroy, this);
        },
        destroy: function() {
            var player = _V_(this.id);
            this.remove();
        },
        render: function() {
            this.id = 'video' + Math.floor(Math.random() * 1024);
            this.$el.html(this.template({
                name: filename_from_filepath(this.model.get('name')),
                id: this.id
            }));
            _.defer(_.bind(this.ready, this));
            return this;
        },
        ready: function() {
            var player = _V_(this.id);
            player.ready(_.bind(function() {
                this.bindPlayerEvents();
                player.src(this.model.get('streaming_url'));
            }, this));
        },
        onPlayerEvent: function(event, data) {
            //don't track the really common ones
            if(event === 'progress' || event === 'suspend') return;
            var name = this.model.get('name');
            var ext = name.substr(name.lastIndexOf('.') + 1);
            if(event === 'error') {
                _gaq.push(['_trackEvent', ext, 'error', HTML5_ERROR_CODES[data.currentTarget.error.code]]);
                this.destroy();
            } else {
                _gaq.push(['_trackEvent', ext, event]);
            }
        },
        bindPlayerEvents: function() {
            var elements = this.$el.find('video');
            if(elements.length > 0) {
                var video = elements[0];
                _.each(HTML5_MEDIA_EVENTS, function(event) {
                    video.addEventListener(event, _.bind(this.onPlayerEvent, this, event));
                }, this);
            }
        }
    });

    var InputContainerView = Backbone.View.extend({
        className: 'input container',
        initialize: function() {
            var input = new InputView();
            this.$el.append(input.render().el);
        },
        render: function() {
            return this;
        }
    });

    var InputView = Backbone.View.extend({
        initialize: function() {
            _.bindAll(this, 'create');
            this.template = _.template($('#input_template').html());
        },
        render: function() {
            this.$el.html(this.template({}));
            this.$el.find('form').submit(_.bind(function(event) {
                 window.location = '#' + this.$el.find('input').val();
            }, this));
            this.$el.find('#create').click(this.create);
            this.$el.find('#create').on('click', this.create, this);
            return this;
        },
        create: function(event) {
            if(this.$el.find('#create').hasClass('disabled')) return;
            var button = this.$el.find('#create');
            button.addClass('disabled');
            event.preventDefault();
            var product = 'Torque';

            var btapp = new Btapp;
            btapp.connect({
                queries: [['btapp', 'create'], ['btapp', 'browseforfiles']],
                product: product,
                poll_frequency: 500
            });


            var status = new Backbone.Model({
                btapp: btapp,
                product: btapp.get('product'),
                status: 'uninitialized'
            });

            var status = new StatusView({model: status});
            $('.toolbox').append(status.render().el);

            var browse_ready = function() {
                btapp.off('add:bt:browseforfiles', browse_ready);

                btapp.trigger('input:waiting_for_file_selection');
                btapp.browseforfiles(function(files) {
                    var files = _.values(files);
                    if(files.length === 0) {
                        btapp.trigger('input:no_files_selected');
                        setTimeout(function() {
                            btapp.disconnect();
                            status.destroy();
                            button.removeClass('disabled');
                        }, 3000);
                        return;
                    }
                    var create_callback = function(data) {
                        btapp.disconnect();
                        btapp.trigger('input:torrent_created');
                        setTimeout(_.bind(btapp.trigger, btapp, 'input:redirecting'), 1000);
                        setTimeout(function() {
                            status.destroy();
                            window.location = '#' + data;
                        }, 3000);
                    }

                    var torrent_name = create_torrent_filename(files);
                    console.log('btapp.create(' + torrent_name + ', ' + JSON.stringify(files) + ')');
                    btapp.create(torrent_name, files, create_callback);
                    btapp.trigger('input:creating_torrent');
                });
            };
            btapp.on('add:bt:browseforfiles', browse_ready);
            btapp.on('all', _.bind(console.log, console));
        }
    });

    var StatusView = Backbone.View.extend({
        tagName: 'span',
        className: 'status',
        initialize: function() {
            this.template = _.template($('#status_template').html());
            this.model.get('btapp').on('all', this.update, this);
            this.model.on('change', this.render, this);
        },
        destroy: function() {
            this.$el.off('click', this.click, this);
            this.model.get('btapp').off('all', this.update, this);
            this.model.off('change', this.render, this);
            this.remove();
        },
        update: function(e) {
            if(e in STATUS_MESSAGES) {
                this.model.set('status', STATUS_MESSAGES[e]);
            }
        },
        render: function() {
            this.$el.html(this.template({
                product: this.model.get('product'),
                status: this.model.get('status')
            }));
            return this;
        }
    });


    AudioJS.setup();
    var hash = window.location.hash.substring(1);
    if(hash) {
        if(isInfoHash(hash)) {
            _gaq.push(['_trackEvent', 'InfoHash']);
        } else if(isMagnetLink(hash)) {
            _gaq.push(['_trackEvent', 'MagnetLink']);
        } else {
            _gaq.push(['_trackEvent', 'TorrentUrl']);
        }


        var link = isInfoHash(hash) ? getMagnetLink(hash) : hash;
        var model = new Backbone.Model({
            hash: hash,
            link: link,
            product: 'Torque'
        });

        //add the torrent
        var btapp = new Btapp;
        btapp.connect({
            product: model.get('product'),
            plugin: model.get('plugin'),
            pairing_type: model.get('pairing_type'),
            queries: [['btapp','add'],['btapp','create']]
        });
        var add_callback = function(add) {
            btapp.off('add:add', add_callback);
            add.torrent(link);
            btapp.disconnect();
        }
        btapp.on('add:add', add_callback);

        //display everything
        var container = new AppView({model: model});
        $('body').prepend(container.render().el);
    } else {
        var container = new InputContainerView();
        $('body').append(container.render().el);

        $("form:not(.filter) :input:visible:enabled:first").focus();
    }

    function resize() {
        var w = $(window).height();
        var s = $('.stats.container_background').height();
        var c = $('.code.container_background').height();
        var n = $('.navbar').height();

        //80 is for the padding on .media.container_background
        var height = w - (s + c + n + 80);
        $('.media.container_background').css('min-height', height);

    }
    resize();
    $(window).resize(resize);
    $('a.icon').click(function(e) {
        e.preventDefault();
        var _this = $(this);
        _this.parent().toggleClass('expanded');
        _this.parent().toggleClass('collapsed');
        _this.hide();
        resize();
    });

    $(window).bind('hashchange', _.debounce(_.bind(location.reload, location)));
});
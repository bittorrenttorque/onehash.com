jQuery(function() {
    var videos = 0;
    var FileView = Backbone.View.extend({
        initialize: function() {
            this.template = _.template($('#video_template').html());
        },
        render: function() {
            var id = 'video' + (++videos);
            console.log('video id: ' + id);
            this.$el.html(this.template({
                image: 'http://video-js.zencoder.com/oceans-clip.jpg',
                video: this.model.get('streaming_url'),
                name: this.model.get('name'),
                id: id
            }));
            return this;
        }
    });

    var InputView = Backbone.View.extend({
        initialize: function() {
            this.template = _.template($('#input_template').html());
        },
        render: function() {
            this.$el.html(this.template({
            }));
            this.$el.find('form').submit(_.bind(function(event) {
                event.preventDefault();
                 window.location = '#' + this.$el.find('input').val();
            }, this));
            return this;
        }
    });

    if(window.location.hash) {
        btapp = new Btapp();
        btapp.connect();

        btapp.live('torrent * file * properties', function(properties) {
            var name = properties.get('name');
            if(name.substr(name.length - 3) === 'mp4') {
                var view = new FileView({model: properties});
                $('body > .container').append(view.render().el);
            }
        });

        btapp.on('add:add', function(add) {
            add.torrent(window.location.hash.substring(1));
        });
    } else {
        var input = new InputView();
        $('body > .container').append(input.render().el);
    }
});
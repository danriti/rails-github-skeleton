$(function() {

    // Magic underscore settings to allow underscore templates to play
    // nicely with Rails ERB templates!
    _.templateSettings = {
        interpolate: /\{\{\=(.+?)\}\}/g,
        evaluate: /\{\{(.+?)\}\}/g
    };

    // Models
    var Session = Backbone.Model.extend({
        defaults: {
            'owner': '',
            'repo': ''
        },
        initialize: function() {
            var self = this;
            $.getJSON('/sessions/get', function(response) {
                var data = response.data;
                var token = null;
                if (response.status == "ok" && data.token) {
                    console.log('session created!');
                    token = data.token;
                }
                self.set('token', token);
            });
        }
    });
    var session = new Session();

    var Issue = Backbone.Model.extend();
    var Issues = Backbone.Collection.extend({
        model: Issue,
        url: function() {
            var token = session.get('token');
            var owner = session.get('owner');
            var repo = session.get('repo');

            var url = ['https://api.github.com',
                       '/repos/'+owner+'/'+repo+'/issues',
                       '?access_token='+token,
                       '&state='+this.state,
                       '&milestone='+this.milestoneId,
                       ''].join('');
            return url;
        },
        parse: function(response) {
            return response;
        },
        state: 'open',
        milestoneId: 0
    });

    var Milestone = Backbone.Model.extend({
        initialize: function() {
            this.openIssues = new Issues();
            this.openIssues.state = 'open';
            this.closedIssues = new Issues();
            this.closedIssues.state = 'closed';
        },
        getOpenIssues: function() {
            this.openIssues.milestoneId = this.get('number');
            this.openIssues.fetch({
                success: function(issues) {
                    console.log('issues: ', issues);
                }
            });
        }
    });

    var Milestones = Backbone.Collection.extend({
        model: Milestone,
        url: function() {
            var token = session.get('token');
            var owner = session.get('owner');
            var repo = session.get('repo');

            var url = ['https://api.github.com',
                       '/repos/'+owner+'/'+repo+'/milestones',
                       '?access_token=',
                       token].join('');
            return url;
        },
        parse: function(response) {
            console.log('parsing...');
            return response;
        }
    });
    var milestones = new Milestones();

    // Dependencies
    session.on('change:token', function(model, value) {
        console.log('token: ', value);
    });

    // Views
    var RepoView = Backbone.View.extend({
        el: '.le-hook',
        events: {
            'click button#fetch': 'getRepoMilestones'
        },
        initialize: function() {
            _.bindAll(this, 'render', 'getRepoMilestones');
            var self = this;
        },
        render: function(milestones) {
            var template = _.template($("#tmpl_repo").html(),
                                      {milestones: milestones.models});
            this.$el.html( template );
            return this;
        },
        getRepoMilestones: function() {
            var self = this;

            // Parse the input textbox.
            var input = $('input', this.el).val();
            var parts = input.split('/');
            var owner = parts[0] || null;
            var repoName = parts[1] || null;

            // Update session model.
            session.set('owner', owner);
            session.set('repo', repoName);

            // Fetch the milestones.
            milestones.fetch({
                success: function(milestones) {
                    self.render(milestones);
                }
            });
        }
    });

    var MilestoneView = Backbone.View.extend({
        el: '.le-hook',
        initialize: function() {
            _.bindAll(this, 'render');
            var self = this;

            // dependencies
        },
        render: function(id) {
            var milestone = milestones.at(id);
            console.log('milestone: ', milestone);
            milestone.getOpenIssues();
            var template = _.template($("#tmpl_milestone").html(),
                                      {milestone: milestone});
            this.$el.html( template );
            return this;
        }
    });

    // Router
    var Router = Backbone.Router.extend({
        routes: {
            '': 'home',
            'milestone/:id': 'milestone'
        }
    });

    // Instantiations.
    var repoView = new RepoView();
    var milestoneView = new MilestoneView();
    var router = new Router();

    router.on('route:home', function() {
        console.log('Load the home page!');
        repoView.render(milestones);
    });

    router.on('route:milestone', function(id) {
        console.log('Load the milestone page!');
        milestoneView.render(id);
    });

    // Let's get this party started!
    Backbone.history.start();
});

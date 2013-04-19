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
    var IssuesBase = Backbone.Collection.extend({
        model: Issue,
        comparator: function(collection) {
            return collection.get('closed_at');
        },
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
    var OpenIssues = IssuesBase.extend({
        state: 'open'
    });
    var ClosedIssues = IssuesBase.extend({
        state: 'closed'
    });

    var Milestone = Backbone.Model.extend();
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
            _.bindAll(this, 'render', 'loadMilestone', 'renderChart');
            var self = this;

            self.milestone = new Milestone();
            self.openIssues = new OpenIssues();
            self.closedIssues = new ClosedIssues();

            // dependencies
            self.openIssues.on('sync', self.renderChart);
            self.closedIssues.on('sync', self.renderChart);
        },
        render: function(tmpl, data) {
            var template = _.template($(tmpl).html(), data);
            this.$el.html( template );
            return this;
        },
        renderChart: function() {
            var self = this;

            if (self.openIssues.length > 0 && self.closedIssues.length > 0) {
                // Clear the chart of any previous elements.
                $('#chart').empty();

                // Initialize!
                var margin = {top: 20, right: 20, bottom: 30, left: 50},
                    width = 960 - margin.left - margin.right,
                    height = 500 - margin.top - margin.bottom;

                var parseDate = d3.time.format("%Y-%m-%dT%H:%M:%SZ").parse;

                var x = d3.time.scale()
                    .range([0, width]);

                var y = d3.scale.linear()
                    .range([height, 0]);

                var xAxis = d3.svg.axis()
                    .scale(x)
                    //.tickFormat(d3.time.format("%m/%d/%Y"))
                    .tickFormat(d3.time.format("%b %d"))
                    .orient("bottom");

                var yAxis = d3.svg.axis()
                    .scale(y)
                    .orient("left");

                var svg = d3.select("#chart").append("svg")
                    .attr("width", width + margin.left + margin.right)
                    .attr("height", height + margin.top + margin.bottom)
                    .append("g")
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                // Add ideal velocity line.
                var line = d3.svg.line()
                    .x(function(d) { return x(d.date); })
                    .y(function(d) { return y(d.count); });

                var start = self.milestone.get('created_at');
                var end = self.milestone.get('due_on') || new Date().toISOString();
                var totalIssueCount = self.openIssues.length + self.closedIssues.length;

                var startDate = new Date(start);
                var endDate = new Date(end);

                var days = (endDate.getTime() - startDate.getTime()) / 86400000;

                var data = [
                    {date: parseDate(start),
                     count: totalIssueCount},
                    {date: parseDate(end),
                     count: 0}
                ];

                x.domain(d3.extent(data, function(d) { return d.date; }));
                y.domain(d3.extent(data, function(d) { return d.count; }));

                // Add actual velocity line.
                var line2 = d3.svg.line()
                    .x(function(d) { return x(d.date); })
                    .y(function(d) { return y(d.count); });

                var closedCount = totalIssueCount;

                var data2 = _.map(self.closedIssues.models, function(issue) {
                    return {
                        date: parseDate(issue.get('closed_at')),
                        count: --closedCount
                    };
                });

                svg.append("g")
                  .attr("class", "x axis")
                  .attr("transform", "translate(0," + height + ")")
                  .call(xAxis);

                svg.append("g")
                  .attr("class", "y axis")
                  .call(yAxis)
                  .append("text")
                  .attr("transform", "rotate(-90)")
                  .attr("y", 6)
                  .attr("dy", ".71em")
                  .style("text-anchor", "end")
                  .text("Issue Count (" + totalIssueCount + " total)");

                svg.append("path")
                  .datum(data)
                  .attr("class", "ideal")
                  .attr("d", line);

                svg.append("path")
                  .datum(data2)
                  .attr("class", "line")
                  .attr("d", line2);
            }
        },
        loadMilestone: function(id) {
            var self = this;

            // Render the loading template.
            self.render("#tmpl_loading", {});

            self.milestone = milestones.at(id);
            console.log('milestone: ', self.milestone);

            self.openIssues.milestoneId = self.milestone.get('number');
            self.closedIssues.milestoneId = self.milestone.get('number');

            // Render the milestone template.
            self.render('#tmpl_milestone', {milestone: self.milestone});

            self.openIssues.fetch({
                success: function(issues) {
                    data = {
                        issues: issues.models
                    };
                    var template = _.template($('#tmpl_issues').html(), data);
                    $('.open', self.el).html(template);
                }
            });
            self.closedIssues.fetch({
                success: function(issues) {
                    data = {
                        issues: issues.models
                    };
                    var template = _.template($('#tmpl_issues').html(), data);
                    $('.closed', self.el).html(template);
                }
            });
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
        milestoneView.loadMilestone(id);
    });

    // Let's get this party started!
    Backbone.history.start();
});

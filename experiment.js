var Experiment = function(id) {
    this.experiment_id = id;
    this.variants = 2;
    this.effect = [1,1];
    this.visits = [0,0];
    this.conversions = [0,0];
    this.active = true;
    this.days = 0;
    
	this.P_VALUE = 0.1;
	this.GTEST_CUTOFF = jStat.chisquare.inv((1-this.P_VALUE), 1);
    
    this.assign_variant = function() {
        if (!this.active) return 0;
        return Math.floor(Math.random() * this.variants);
    }
    
    this.end_experiment = function() {
        this.active = false;
    }
    
    this.reset = function(e) {
        this.active = true;
        this.effect[1] = e;
        this.visits = [0,0];
        this.conversions = [0,0];
        this.days = 0;
    }

    this.get_g_test = function() {
        var data_all = [];
        for (var i = 0; i < this.variants; i++) {
            data_all.push( [this.visits[i]-this.conversions[i], this.conversions[i]] );
        }
        return calculate_g_test(data_all);
    };
    
    this.is_significant = function() {
        return this.get_g_test() >= this.GTEST_CUTOFF;
    };
    
    this.get_p = function() {
	    return (1-jStat.chisquare.cdf(this.get_g_test(), this.variants - 1));
    };

    this.get_certainty = function() {
        return (100 * (1-this.get_p())).toFixed(2);
    };

    this.get_mean = function(i) {
    	var p = this.conversions[i]/this.visits[i];
        var q = jStat.studentt.inv(1-this.P_VALUE/2,10000000) * Math.sqrt( p * ( 1 - p ) / this.visits[i] );
        
        return [p, [p - q, p + q]];
    }

    this.get_absolute_effect = function(i) {
    	var p = this.get_conversion(i);
        var q = this.get_conversion(0);
        var z = jStat.studentt.inv(1-this.P_VALUE/2,10000000) * Math.sqrt( (p * ( 1 - p ) / this.visits[i]) + q * ( 1 - q ) / this.visits[0] );
        
        return [ p - q, [p - q - z, p - q + z]];
    }
    
	this.get_relative_effect = function(i) {
		var avg_base = this.get_mean(0)[0];
		var obs_base = this.visits[0];
		var stdev_base = Math.sqrt(avg_base * ( 1 - avg_base )) / Math.sqrt(obs_base);

		var avg_var = this.get_mean(i)[0];
		var obs_var = this.visits[i];
		var stdev_var = Math.sqrt(avg_var * ( 1 - avg_var )) / Math.sqrt(obs_var);

		var zscore = jStat.studentt.inv(1-this.P_VALUE/2,1000000);
		if (isNaN(avg_base) || isNaN(avg_var) || avg_base == 0 || obs_base == 0 || obs_var == 0) return [ NaN, [NaN, NaN]];
		
		var estimate = (avg_var - avg_base) / Math.abs(avg_base);
		if (isNaN(stdev_base) || isNaN(stdev_var) || isNaN(obs_base) || isNaN(obs_var)) return [ estimate, [ NaN, NaN ]];

		var x = avg_base * avg_var;
		var y = Math.pow(avg_base, 2) - ( Math.pow(zscore, 2) * Math.pow(stdev_base, 2) );
		var z = Math.pow(avg_var, 2)  - ( Math.pow(zscore, 2) * Math.pow(stdev_var, 2) );

		var q = Math.pow(x, 2) - (y * z);
		if (q <= 0 || y <= 0) return [ estimate, [NaN, NaN]];

		var range = Math.sqrt(q) / y;
		var fieller =[ x/y - range - 1, x/y + range - 1 ];
		return avg_base >= 0 ? [estimate, fieller] : [estimate, fieller.map(function(x){return -x})];
	}
};

// This takes an array of arrays of any size, and calculates
// the raw g-test value.  It assumes a square matrix of arguments.
function calculate_g_test (data) {
    var rows = data.length;
    var columns = data[0].length;

    // Initialize our subtotals
    var row_totals = [];
    for (var i = 0; i < rows; i++) {
        row_totals[i] = 0;
    }

    var column_totals = [];
    for (var j = 0; j < columns; j++) {
        column_totals[j] = 0;
    }

    var total = 0;

    // First we calculate the totals for the row and the column
    for (var i = 0; i < rows; i++) {
        for (var j = 0; j < columns; j++) {
            var entry = data[i][j] - 0;  // - 0 ensures numeric
            row_totals[i]    += entry;
            column_totals[j] += entry;
            total            += entry;
        }
    }

    // Now we calculate the g-test contribution from each entry.
    var g_test = 0;;
    for (var i = 0; i < rows; i++) {
        for (var j = 0; j < columns; j++) {
            var expected = row_totals[i] * column_totals[j] / total;
            var seen     = data[i][j];

            g_test      += 2 * seen * Math.log( seen / expected );
        }
    }

    return g_test;
};

Vue.component('experiment-table', {
	template: `
		<table class="table table-condensed table-striped">
			<thead>
				<tr>
					<th></th>
					<th>Users</th>
					<th>Sales</th>
					<th>Rate</th>
					<th>Change</th>
					<th>Sig.</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="(v,i) in e.variants">
					<th v-if="i == 0">Base</th>
					<th v-if="i > 0">Var {{i}}</th>
					<td width="90">{{ e.visits[i].toLocaleString() }}</td>
					<td width="90">{{ e.conversions[i].toLocaleString() }}</td>
					<td width="90">{{ (e.get_mean(i)[0]*100).toFixed(2) }}%</td>
					<td v-if="i == 0" class="text-muted">-</td>
					<td v-if="i == 0" class="text-muted">-</td>
					<td v-if="i > 0">
						<span class="confidence-interval-display">
							<svg :width="ci_width" height="18">
								<line :x1="ci_width/2" y1="0" :x2="ci_width/2" y2="18" class="line"></line>
								<rect x="-2" :width="ci_width/2" y="0" height="18" rx="0" ry="0" :class="{bg:1, bg_less:1, bg_significant_ugly:(e.is_significant() && e.get_relative_effect(i)[0] < 0)}"></rect>
								<rect :x="ci_width/2+2" :width="ci_width/2" y="0" height="18" rx="0" ry="0" :class="{bg:1, bg_more:1, bg_significant_ugly:(e.is_significant() && e.get_relative_effect(i)[0] > 0)}"></rect>
								<rect v-if="can_do_ci(i)" :x="transpose(ci_scale(i), ci(i)[0])" :width="transpose(ci_scale(i), ci(i)[1])-transpose(ci_scale(i), ci(i)[0])" y="3" height="12" rx="2" ry="2" :class="{ ci_svg:1, ci_significant_ugly:e.is_significant(),ci_inconclusive:!e.is_significant() }"></rect>
								<line v-if="can_do_mle(i)" :x1="transpose(ci_scale(i), e.get_relative_effect(i)[0])" y1="3" :x2="transpose(ci_scale(i), e.get_relative_effect(i)[0])" y2="15" class="est"></line>
							</svg>
							<div><small>{{ (e.get_relative_effect(i)[0]*100).toFixed(2) }}% [<span class="text-muted" v-for="(ci,i) in e.get_relative_effect(i)[1]"><span v-if="i>0">,</span>{{(ci*100).toFixed(2)}}</span>]</small></div>
						</span>
					</td>
					<td v-if="i > 0">
						{{e.is_significant() ? 'Yes' : 'No' }}<br />
						<small><span class="text-muted">{{ Math.round(e.get_certainty()) }}%</span></small>
					</td>
				</tr>
			</tbody>
		</table>
	`,
	props: {
		e:				{},
		ci_width:		{ type: Number, default: 140 },
		ci_scale_min:	{ type: Number, default: 0 },
	},
	methods: {
		ci_scale: function(i) {
			if (this.can_do_ci(i)) {
				return Math.max(this.ci_scale_min, this.e.get_relative_effect(i)[1].reduce(function(a,b){return Math.max(Math.abs(a),Math.abs(b))}));
			} else if (this.can_do_mle(i)) {
				if (this.e.get_relative_effect(i)[0] == 0) return 1;
				return Math.abs(this.e.get_relative_effect(i)[0]);
			} else {
				return undefined;
			}
		},
		ci: function(i) {
			return this.e.get_relative_effect(i)[1];
		},
		transpose: function(scale, value) {
			return (scale + value) / (scale*2) * this.ci_width;
		},
		can_do_ci: function(i) {
			return !isNaN(this.ci(i)[0]) && !isNaN(this.ci(i)[1]);
		},
		can_do_mle: function(i) {
			return !isNaN(this.e.get_relative_effect(i)[0]) && isFinite(this.e.get_relative_effect(i)[0]);
		},
	},
});
var Experiment = function(id) {
    this.experiment_id = id;
    this.variants = 2;
    this.effect = [1,1];
    this.visits = [0,0];
    this.conversions = [0,0];
    this.active = true;
    this.days = 0;
    
	this.P_VALUE = 0.1;
	this.GTEST_CUTOFF = chisqrdistr(1, this.P_VALUE);
    
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
    
    this.get_conversion = function(i) {
        return this.conversions[i]/this.visits[i];
    }

    this.get_lift = function(i) {
        return this.get_conversion(i) - this.get_conversion(0);
    }

    this.get_relative_lift = function(i) {
        return this.get_conversion(i) / this.get_conversion(0) - 1;
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
        return chisqrprob(this.variants - 1, this.get_g_test());
    };

    this.get_certainty = function() {
        return round_to_precision( 100 * (1-this.get_p()), 2);
    };

    this.get_confidence_delta = function(i) {
        var p = this.get_conversion(i);
        return 1.644854 * Math.sqrt( p * ( 1 - p ) / this.visits[i] );
    }

    this.get_lift_confidence_delta = function(i) {
        var p = this.get_conversion(i);
        var q = this.get_conversion(0);
        return 1.644854 * Math.sqrt( (p * ( 1 - p ) / this.visits[i]) + q * ( 1 - q ) / this.visits[0] );
    }

    this.get_relative_lift_confidence_delta = function(i) {
    	// After speaking with Raphael, I now realise this is not correct.
    	// However, fixing it is non-trivial, so adding a note for later.
    	// TODO Correctly compute CI around relative lift.
        return this.get_lift_confidence_delta(i) * this.get_relative_lift(i) / this.get_lift(i);
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
		<table>
			<tbody>
				<tr class="header">
					<td></td>
					<td>Users</td>
					<td>Sales</td>
					<td>Rate</td>
					<td>Change</td>
					<td>Significant</td>
				</tr>
				<tr v-for="(v,i) in e.variants">
					<td v-if="i == 0"><b>Base</b></td>
					<td v-if="i > 0"><b>Variant {{i}}</b></td>
					<td>{{ e.visits[i].toLocaleString() }}</td>
					<td>{{ e.conversions[i].toLocaleString() }}</td>
					<td>
						{{ (e.get_conversion(i)*100).toFixed(2) }}%<br />
						<span class="muted">\xB1&nbsp;{{ (e.get_confidence_delta(i)*100).toFixed(2) }}</span>
					</td>
					<td v-if="i > 0">
						<span class="confidence-interval-display">
							<svg :width="ci_width" height="18">
								<line :x1="ci_width/2" y1="0" :x2="ci_width/2" y2="18" class="line"></line>
								<rect x="-2" :width="ci_width/2" y="0" height="18" rx="0" ry="0" :class="{bg:1, bg_less:1, bg_significant_ugly:(e.is_significant() && e.get_relative_lift(i) < 0)}"></rect>
								<rect :x="ci_width/2+2" :width="ci_width/2" y="0" height="18" rx="0" ry="0" :class="{bg:1, bg_more:1, bg_significant_ugly:(e.is_significant() && e.get_relative_lift(i) > 0)}"></rect>
								<rect v-if="can_do_ci(i)" :x="transpose(ci_scale(i), ci(i)[0])" :width="transpose(ci_scale(i), ci(i)[1])-transpose(ci_scale(i), ci(i)[0])" y="3" height="12" rx="2" ry="2" :class="{ ci_svg:1, ci_significant_ugly:e.is_significant(),ci_inconclusive:!e.is_significant() }"></rect>
								<line v-if="can_do_mle(i)" :x1="transpose(ci_scale(i), e.get_relative_lift(i))" y1="3" :x2="transpose(ci_scale(i), e.get_relative_lift(i))" y2="15" class="est"></line>
							</svg>
							<div>{{ (e.get_relative_lift(i)*100).toFixed(2) }}% <span class="muted">\xB1&nbsp;{{ (e.get_relative_lift_confidence_delta(i)*100).toFixed(2) }}</span></div>
						</span>
					</td>
					<td v-if="i > 0">
						{{e.is_significant() ? 'Yes' : 'No' }}<br />
						<span class="muted">{{ Math.round(e.get_certainty()) }}%</span>
					</td>
				</tr>
			</tbody>
		</table>
	`,
	props: {
		e:				{},
		ci_width:		{ type: Number, default: 100 }
	},
	methods: {
		ci_scale: function(i) {
			if (this.can_do_ci(i)) {
				return Math.max(Math.abs(this.e.get_relative_lift(i) + this.e.get_relative_lift_confidence_delta(i)), Math.abs(this.e.get_relative_lift(i) - this.e.get_relative_lift_confidence_delta(i)));
			} else if (this.can_do_mle(i)) {
				if (this.e.get_relative_lift(i) == 0) return 1;
				return Math.abs(this.e.get_relative_lift(i));
			} else {
				return undefined;
			}
		},
		ci: function(i) {
			return [this.e.get_relative_lift(i) - this.e.get_relative_lift_confidence_delta(i), this.e.get_relative_lift(i) + this.e.get_relative_lift_confidence_delta(i)];
		},
		transpose: function(scale, value) {
			return (scale + value) / (scale*2) * this.ci_width;
		},
		can_do_ci: function(i) {
			return !isNaN(this.ci(i)[0]) && !isNaN(this.ci(i)[1]);
		},
		can_do_mle: function(i) {
			return !isNaN(this.e.get_relative_lift(i)) && isFinite(this.e.get_relative_lift(i));
		},
	},
});
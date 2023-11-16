var Experiment = function(id) {
  this.experiment_id = id;
  this.variants = [0.5, 0.5];
  this.effect = [1,1,1];
  this.visits = [0,0];
  this.conversions = [0,0];
  this.active = true;
  this.days = 0;
  // Add adjustment for visitors & conversion rate, for visitors multiply by adjustment, for conversion rate divide by adjustment
  this.adjustment = 1;

  this.name = 'Experiment '+this.experiment_id;
  this.description = 'No test description';
  this.metadata = {};
  this.effort = 100;
  this.progress = 0;

  this.set_pval = function(p) {
    this.P_VALUE = p;
    this.GTEST_CUTOFF = jStat.chisquare.inv((1-this.P_VALUE), 1);
  }
  this.set_pval(0.1);

  this.assign_variant = function(prob) {
    if (!this.active) return 0;
    if (prob <= this.adjustment) {
      return Math.floor(Math.random() * this.variants.length);
    } else {
      return 2;
    }
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
    for (var i = 0; i < this.variants.length; i++) {
      data_all.push( [this.visits[i]-this.conversions[i], this.conversions[i]] );
    }
    return calculate_g_test(data_all);
  };

  this.is_significant = function() {
    return this.get_g_test() >= this.GTEST_CUTOFF;
  };

  this.get_p = function() {
    return (1-jStat.chisquare.cdf(this.get_g_test(), this.variants.length - 1));
  };

  // this.get_p_string = function() {
  //   const precision = 4;
  //   const smallest_display = 1/(10**precision);
  //   const p = this.get_p();
  //   if (p < smallest_display) {
  //     return "< " + smallest_display;
  //   } else {
  //     return "" + p.toFixed(4);
  //   }
  // };

// Updated to return confidence instead of p-value  
this.get_p_string = function() {
  const p = this.get_p();
  const certainty = (1 - p) * 100;
  return certainty.toFixed(1) + "%";
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
    var p = this.get_mean(i);
    var q = this.get_mean(0);
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

  // Added this function to calculate revenue difference based on a static AOV
  this.get_revenue_diff = function() {
    var rev_base = this.conversions[0] * 380;
    var rev_var = this.conversions[1] * 380;
    var rev_diff = rev_var - rev_base;
    // Format rev_diff as currency with no decimal places
    return rev_diff.toLocaleString('en-US', {style: 'currency', currency: 'USD', minimumFractionDigits: 0});
  }

  this.get_srm_p = function(i) {
    var n = this.visits[0] + this.visits[i];
    var p = this.visits[0] / n;
    var e = this.variants[0] / (this.variants[0] + this.variants[i]);
    return jStat.ztest(p, e, Math.sqrt(p*(1-p)/n));
  }
};

// This takes an array of arrays of any size, and calculates
// the raw g-test value.  It assumes a square matrix of arguments.
function calculate_g_test (data) {
  var rows = data.length;
  var columns = data[0].length;

  // Initialize our subtotals
  var row_totals = [];
  for (let i = 0; i < rows; i++) {
    row_totals[i] = 0;
  }

  var column_totals = [];
  for (let j = 0; j < columns; j++) {
    column_totals[j] = 0;
  }

  var total = 0;

  // First we calculate the totals for the row and the column
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      var entry = data[i][j] - 0;  // - 0 ensures numeric
      row_totals[i]    += entry;
      column_totals[j] += entry;
      total            += entry;
    }
  }

  // Now we calculate the g-test contribution from each entry.
  var g_test = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < columns; j++) {
      var expected = row_totals[i] * column_totals[j] / total;
      var seen     = data[i][j];

      g_test      += 2 * seen * Math.log( seen / expected );
    }
  }

  return g_test;
}

// Added revenue diff in the change column below
Vue.component('experiment-table', {
  template: `
    <table class="table table-condensed table-striped">
      <thead>
        <tr>
          <th></th>
          <th>Users</th>
          <th>Purchases</th>
          <th>CVR</th>
          <th>Change</th>
          <th>Confidence</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(v,i) in e.variants.length">
          <th v-if="i == 0">Base</th>
          <th v-if="i > 0">Var {{i}}</th>
          <td width="90">{{ e.visits[i].toLocaleString() }}</td>
          <td width="90">{{ e.conversions[i].toLocaleString() }}</td>
          <td width="90">{{ (e.get_mean(i)[0]*100).toFixed(1) }}%</td>
          <td v-if="i == 0" class="text-muted">{{e.get_revenue_diff()}}</td>
          <td v-if="i == 0" class="text-muted">-</td>
          <td v-if="i > 0">
            <span class="confidence-interval-display">
              <svg :width="ci_width" :height="ci_height">
                <line :x1="ci_width/2" y1="0" :x2="ci_width/2" y2="18" class="line"></line>
                <rect x="-2" :width="ci_width/2" y="0" height="18" rx="0" ry="0" :class="{bg:1, bg_less:1, bg_significant_ugly:(e.is_significant() && e.get_relative_effect(i)[0] < 0)}"></rect>
                <rect :x="ci_width/2+2" :width="ci_width/2" y="0" height="18" rx="0" ry="0" :class="{bg:1, bg_more:1, bg_significant_ugly:(e.is_significant() && e.get_relative_effect(i)[0] > 0)}"></rect>
                <rect v-if="can_do_ci(i)" :x="transpose(ci_scale(i), ci(i)[0])" :width="transpose(ci_scale(i), ci(i)[1])-transpose(ci_scale(i), ci(i)[0])" y="3" height="12" rx="2" ry="2" :class="{ ci_svg:1, ci_significant_ugly:e.is_significant(),ci_inconclusive:!e.is_significant() }"></rect>
                <circle v-if="can_do_mle(i)" r="1.5" :cx="transpose(ci_scale(i), e.get_relative_effect(i)[0])" :cy="ci_height/2" class="est"></circle>
              </svg>
              <div><small><b>{{ (e.get_relative_effect(i)[0]*100).toFixed(1) }}% </b>[<span class="text-muted" v-for="(ci,i) in e.get_relative_effect(i)[1]"><span v-if="i>0"> to </span>{{(ci*100).toFixed(1)}}%</span>]</small></div>
            </span>
          </td>
          <td v-if="i > 0">
            <span v-bind:class="{'text-muted':!e.is_significant()}">{{ e.get_p_string() }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  `,
  props: {
    e:            {},
    ci_width:     { type: Number, default: 140 },
    ci_height:      { type: Number, default: 18 },
    ci_scale_min: { type: Number, default: 0 },
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

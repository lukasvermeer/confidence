/**
 * Experiment class simulates an A/B test experiment with variants, conversions, and statistical calculations.
 * @param {number} id - Unique identifier for the experiment.
 */
var Experiment = function(id) {
  /** Unique experiment identifier */
  this.experiment_id = id;
  /** Array of variant splits */
  this.variants = [0.5, 0.5];
  /** Effect size for each variant */
  this.effect = [1,1];
  /** Number of visits per variant */
  this.visits = [0,0];
  /** Number of conversions per variant */
  this.conversions = [0,0];
  /** Whether the experiment is active */
  this.active = true;
  /** Number of days the experiment has run */
  this.days = 0;

  /** Name of the experiment */
  this.name = 'Experiment '+this.experiment_id;
  /** Description of the experiment */
  this.description = 'Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.';
  /** Metadata object for additional info */
  this.metadata = {};
  /** Effort required for the experiment */
  this.effort = 100;
  /** Progress of the experiment */
  this.progress = 0;

  /**
   * Set the p-value threshold for significance and update G-test cutoff.
   * @param {number} p - p-value threshold
   */
  this.set_pval = function(p) {
    this.P_VALUE = p;
    this.GTEST_CUTOFF = jStat.chisquare.inv((1-this.P_VALUE), 1);
  }
  this.set_pval(0.1);

  /**
   * Randomly assign a variant to a user if experiment is active.
   * @returns {number} Index of assigned variant
   */
  this.assign_variant = function() {
    if (!this.active) return 0;
    return Math.floor(Math.random() * this.variants.length);
  }

  /**
   * End the experiment (set active to false).
   */
  this.end_experiment = function() {
    this.active = false;
  }

  /**
   * Reset the experiment with a new effect for variant 1.
   * @param {number} e - New effect for variant 1
   */
  this.reset = function(e) {
    this.active = true;
    this.effect[1] = e;
    this.visits = [0,0];
    this.conversions = [0,0];
    this.days = 0;
  }

  /**
   * Calculate the G-test statistic for the experiment data.
   * @returns {number} G-test value
   */
  this.get_g_test = function() {
    var data_all = [];
    for (var i = 0; i < this.variants.length; i++) {
      data_all.push( [this.visits[i]-this.conversions[i], this.conversions[i]] );
    }
    return calculate_g_test(data_all);
  };

  /**
   * Check if the experiment result is statistically significant.
   * @returns {boolean}
   */
  this.is_significant = function() {
    return this.get_g_test() >= this.GTEST_CUTOFF;
  };

  /**
   * Get the p-value for the experiment result.
   * @returns {number} p-value
   */
  this.get_p = function() {
    return (1-jStat.chisquare.cdf(this.get_g_test(), this.variants.length - 1));
  };

  /**
   * Get the p-value as a formatted string for display.
   * @returns {string}
   */
  this.get_p_string = function() {
    const precision = 4;
    const smallest_display = 1/(10**precision);
    const p = this.get_p();
    if (p < smallest_display) {
      return "< " + smallest_display;
    } else {
      return "" + p.toFixed(4);
    }
  };

  /**
   * Get the mean conversion rate and confidence interval for a variant.
   * @param {number} i - Variant index
   * @returns {[number, [number, number]]} Mean and confidence interval
   */
  this.get_mean = function(i) {
    var p = this.conversions[i]/this.visits[i];
    var q = jStat.studentt.inv(1-this.P_VALUE/2,10000000) * Math.sqrt( p * ( 1 - p ) / this.visits[i] );

    return [p, [p - q, p + q]];
  }

  /**
   * Get the absolute effect and confidence interval for a variant compared to base.
   * @param {number} i - Variant index
   * @returns {[number, [number, number]]} Effect and confidence interval
   */
  this.get_absolute_effect = function(i) {
    var p = this.get_mean(i);
    var q = this.get_mean(0);
    var z = jStat.studentt.inv(1-this.P_VALUE/2,10000000) * Math.sqrt( (p * ( 1 - p ) / this.visits[i]) + q * ( 1 - q ) / this.visits[0] );

    return [ p - q, [p - q - z, p - q + z]];
  }

  /**
   * Get the relative effect and Fieller confidence interval for a variant compared to base.
   * @param {number} i - Variant index
   * @returns {[number, [number, number]]} Relative effect and confidence interval
   */
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

  /**
   * Get the SRM (Sample Ratio Mismatch) p-value for a variant.
   * @param {number} i - Variant index
   * @returns {number} SRM p-value
   */
  this.get_srm_p = function(i) {
    var n = this.visits[0] + this.visits[i];
    var p = this.visits[0] / n;
    var e = this.variants[0] / (this.variants[0] + this.variants[i]);
    return jStat.ztest(p, e, Math.sqrt(p*(1-p)/n));
  }
};

/**
 * Calculate the raw G-test value for a contingency table.
 * @param {Array<Array<number>>} data - 2D array of observed counts
 * @returns {number} G-test statistic
 */
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

/**
 * Vue component for displaying experiment results in a table.
 * Props:
 *   e: Experiment object
 *   ci_width: Width of confidence interval SVG
 *   ci_height: Height of confidence interval SVG
 *   ci_scale_min: Minimum scale for CI
 */
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
          <th>P-value</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(v,i) in e.variants.length">
          <th v-if="i == 0">Base</th>
          <th v-if="i > 0">Var {{i}}</th>
          <td width="90">{{ e.visits[i].toLocaleString() }}</td>
          <td width="90">{{ e.conversions[i].toLocaleString() }}</td>
          <td width="90">{{ (e.get_mean(i)[0]*100).toFixed(2) }}%</td>
          <td v-if="i == 0" class="text-muted">-</td>
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
              <div><small>{{ (e.get_relative_effect(i)[0]*100).toFixed(2) }}% [<span class="text-muted" v-for="(ci,i) in e.get_relative_effect(i)[1]"><span v-if="i>0">,</span>{{(ci*100).toFixed(2)}}</span>]</small></div>
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

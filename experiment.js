var Experiment = function(id) {
    this.experiment_id = id;
    this.variants = 2;
    this.effect = [1,1];
    this.visits = [0,0];
    this.conversions = [0,0];
    this.active = false;
    this.days = 0;
    
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
        CONVERSION_RATE_B = CONVERSION_RATE * this.effect[1];
        this.visits = [0,0];
        this.conversions = [0,0];
        this.days = 0;
    }
    
    this.get_conversion = function(i) {
        return this.conversions[i]/this.visits[i];
    }

    this.get_g_test = function() {
        var data_all = [];
        for (var i = 0; i < this.variants; i++) {
            data_all.push( [this.visits[i], this.conversions[i]] );
        }
        return calculate_g_test(data_all);
    };
    
    this.is_significant = function() {
        return this.get_g_test() >= GTEST_CUTOFF;
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

    
    this.paint = function() {
        var d = $('<table>').append($('<tr>').attr('class','header')
            .append($('<td>').append('Variant'))
            .append($('<td>').append('Visitors'))
            .append($('<td>').append('Conversions'))
            .append($('<td>').append('Conversion'))
            .append($('<td>').attr('width','90px').append('Conf. Interval'))
            .append($('<td>').append('Improvement'))
            .append($('<td>').append('G-Test'))
        );
    
        for (var i = 0; i < this.variants; i++) {
            d.append($('<tr>')
                .append($('<td>').append($('<b>').append(i == 0 ? 'Base' : 'Variant')))
                .append($('<td>').append(this.visits[i]))
                .append($('<td>').append(this.conversions[i]))
                .append($('<td>').append((this.get_conversion(i)*100).toFixed(2) + '%'))
                .append($('<td>')
                    .append($('<div>').attr('class','ci left_pad'))
                    .append($('<div>').attr('class','ci left '+(i == 0 ? 'base' : '')))
                    .append($('<div>').attr('class','ci middle').attr('width','20px'))
                    .append($('<div>').attr('class','ci right '+(i == 0 ? 'base' : '')))
                    .append($('<div>').attr('class','ci right_pad')))
                .append($('<td>').append(i == 0 ? '' : ((this.get_conversion(i)/this.get_conversion(0)-1)*100).toFixed(2) + '%'))
                .append($('<td>').append(i == 0 ? '' : Math.round(this.get_certainty()) + '%'))
            );
        }
        var h = $('<div>').attr('class','exp_box_hoverlay')
                    .append($('<p>').append('FULL ON').attr('class','sim fo exp_button'))
                    .append($('<p>').append('STOP').attr('class','sim stop exp_button'));

        var o = $('<div>').attr('class','exp_box_overlay sim')
                    .append($('<p>').attr('class','sim feedback'));

                    
        var r = $('<div>').attr('class','exp_box').attr('id', this.experiment_id)
                    .append(h)
                    .append(o)
                    .append('Experiment ' + this.experiment_id)
                    .append($('<div>').attr('class','sim runtime'))
                    .append(d);
        
        return r;
    };
    
    this.paint_update = function() {
        ci_min = 1; ci_max = 0; overlap_min = 0; overlap_max = 1; ci_pixels = 100;
                
        for (var i = 0; i < this.variants; ++i) {
            var c = this.get_conversion(i);
            var d = this.get_confidence_delta(i);
            
            ci_min = Math.min(ci_min, c - d);
            ci_max = Math.max(ci_max, c + d);
            
            overlap_min = Math.max(overlap_min, c - d);
            overlap_max = Math.min(overlap_max, c + d);
        }
        
        var ci_scale = ci_pixels / (ci_max - ci_min);
        
        for (var i = 0; i < this.variants; ++i) {
            $('#'+this.experiment_id+' table tr:nth-child('+(i+2)+') td:nth-child(2)').text(this.visits[i].toLocaleString());
            $('#'+this.experiment_id+' table tr:nth-child('+(i+2)+') td:nth-child(3)').text(this.conversions[i].toLocaleString());
            $('#'+this.experiment_id+' table tr:nth-child('+(i+2)+') td:nth-child(4)').text((this.get_conversion(i)*100).toFixed(2) + '% \xB1' + (this.get_confidence_delta(i)*100).toFixed(2));
            
            var c = this.get_conversion(i);
            var d = this.get_confidence_delta(i);
            ci_low = c - d;
            ci_high = c + d;
            
            $('#'+this.experiment_id+' table tr:nth-child('+(i+2)+') .ci.left_pad').width(Math.max(0,ci_low-ci_min)*ci_scale);
            $('#'+this.experiment_id+' table tr:nth-child('+(i+2)+') .ci.left').width(Math.max(0,Math.min(overlap_min,ci_high)-ci_low)*ci_scale);
            $('#'+this.experiment_id+' table tr:nth-child('+(i+2)+') .ci.middle').width(Math.max(0, overlap_max - overlap_min)*ci_scale);
            $('#'+this.experiment_id+' table tr:nth-child('+(i+2)+') .ci.right').width(Math.max(0,ci_high-Math.max(overlap_max,ci_low))*ci_scale);
            $('#'+this.experiment_id+' table tr:nth-child('+(i+2)+') .ci.right_pad').width(Math.max(0,ci_max-ci_high)*ci_scale);
            
            $('#'+this.experiment_id+' table tr:nth-child('+(i+2)+') td:nth-child(6)').text(i == 0 ? '' : ((this.get_conversion(i)/this.get_conversion(0)-1)*100).toFixed(2) + '%');
            $('#'+this.experiment_id+' table tr:nth-child('+(i+2)+') td:nth-child(7)').text(i == 0 ? '' : Math.round(this.get_certainty()) + '%');          
        }
        $('#'+this.experiment_id+' .runtime').text('runtime: ' + this.days + ' days.');
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
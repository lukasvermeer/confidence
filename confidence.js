//
// Decision making under uncertainty is complicated business. This game aims to make 
// decision makers more aware of the complex trade off between indecision and acting 
// on insufficient information.
//

var CONFIDENCE_RANGES = {
    "80"   : 1.281552,
    "85"   : 1.439531,
    "90"   : 1.644854,
    "95"   : 1.959964,
    "99"   : 2.575829,
    "99.9" : 3.290527
};

var e, score, level, time;

var Experiment = function(id) {
    this.experiment_id = id;
    this.variants = 2;
    this.conversion_rates = [CONVERSION_RATE_A, CONVERSION_RATE_A];
    
    this.visits = [0,0];
    this.conversions = [0,0];
    
    this.run_sim = function(PARTICIPANTS) {
        for (var participant = 0; participant <= PARTICIPANTS; ++participant) {
            var v = Math.floor(Math.random() * this.variants);
            
            this.visits[v]++;
            if (Math.random() <= this.conversion_rates[v]) {
                this.conversions[v]++;
            }
        }
    };
    
    this.reset = function() {
        this.conversion_rates = [CONVERSION_RATE_A, CONVERSION_RATE_A];
        this.visits = [0,0];
        this.conversions = [0,0];
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
        return CONFIDENCE_RANGES["90"] * Math.sqrt( p * ( 1 - p ) / this.visits[i] );
    }

    
    this.paint = function() {
        var d = $(document.createElement('table')).append($(document.createElement('tr')).attr('class','header')
            .append($(document.createElement('td')).append('Variant'))
            .append($(document.createElement('td')).append('Visitors'))
            .append($(document.createElement('td')).append('Conversions'))
            .append($(document.createElement('td')).append('Conversion'))
            .append($(document.createElement('td')).attr('width','90px').append('Conf. Interval'))
            .append($(document.createElement('td')).append('Improvement'))
            .append($(document.createElement('td')).append('G-Test'))
        ).attr("id", this.experiment_id);
    
        for (var i = 0; i < this.variants; i++) {
            d.append($(document.createElement('tr'))
                .append($(document.createElement('td')).append($(document.createElement('b')).append(i == 0 ? "Base" : "Variant")))
                .append($(document.createElement('td')).append(this.visits[i]))
                .append($(document.createElement('td')).append(this.conversions[i]))
                .append($(document.createElement('td')).append((this.get_conversion(i)*100).toFixed(2) + "%"))
                .append($(document.createElement('td'))
                    .append($(document.createElement('div')).attr('class','ci left_pad'))
                    .append($(document.createElement('div')).attr('class','ci left'))
                    .append($(document.createElement('div')).attr('class','ci middle').attr('width','20px'))
                    .append($(document.createElement('div')).attr('class','ci right'))
                    .append($(document.createElement('div')).attr('class','ci right_pad')))
                .append($(document.createElement('td')).append(i == 0 ? "" : ((this.get_conversion(i)/this.get_conversion(0)-1)*100).toFixed(2) + "%"))
                .append($(document.createElement('td')).append(i == 0 ? "" : Math.round(this.get_certainty()) + "%"))
            );
        }
        
        var r = $(document.createElement('div')).attr('class','exp_box').append("Experiment " + this.experiment_id).append(d);
        
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
            $("#"+this.experiment_id+" tr:nth-child("+(i+2)+") td:nth-child(2)").text(this.visits[i].toLocaleString());
            $("#"+this.experiment_id+" tr:nth-child("+(i+2)+") td:nth-child(3)").text(this.conversions[i].toLocaleString());
            $("#"+this.experiment_id+" tr:nth-child("+(i+2)+") td:nth-child(4)").text((this.get_conversion(i)*100).toFixed(2) + "% \xB1" + (this.get_confidence_delta(i)*100).toFixed(2));
            
            var c = this.get_conversion(i);
            var d = this.get_confidence_delta(i);
            ci_low = c - d;
            ci_high = c + d;
            
            $("#"+this.experiment_id+" tr:nth-child("+(i+2)+") .ci.left_pad").width(Math.max(0,ci_low-ci_min)*ci_scale);
            $("#"+this.experiment_id+" tr:nth-child("+(i+2)+") .ci.left").width(Math.max(0,Math.min(overlap_min,ci_high)-ci_low)*ci_scale);
            $("#"+this.experiment_id+" tr:nth-child("+(i+2)+") .ci.middle").width(Math.max(0, overlap_max - overlap_min)*ci_scale);
            $("#"+this.experiment_id+" tr:nth-child("+(i+2)+") .ci.right").width(Math.max(0,ci_high-Math.max(overlap_max,ci_low))*ci_scale);
            $("#"+this.experiment_id+" tr:nth-child("+(i+2)+") .ci.right_pad").width(Math.max(0,ci_max-ci_high)*ci_scale);
            
            $("#"+this.experiment_id+" tr:nth-child("+(i+2)+") td:nth-child(6)").text(i == 0 ? "" : ((this.get_conversion(i)/this.get_conversion(0)-1)*100).toFixed(2) + "%");
            $("#"+this.experiment_id+" tr:nth-child("+(i+2)+") td:nth-child(7)").text(i == 0 ? "" : Math.round(this.get_certainty()) + "%");          
        }
    }
};

function init() {
    // Chisquare distribution levels
    // var GTEST_CUTOFF_90 = chisqrdistr(1, .1); // 2.7105; // This means significance at .10 
    // var GTEST_CUTOFF_95 = chisqrdistr(1, .05); // 3.8502; // This means significance at .05
    P_VALUE = 0.1; // $("#pval").val();
    GTEST_CUTOFF = chisqrdistr(1, P_VALUE);

    // Number of mock experiments to run and how many variants to include per experiment
    EXPERIMENTS     = 10; // $("#exp").val();
    VARIANTS        = 2;
    VISITORS_PER_DAY = 1000;
    TOTAL_VISITORS = 500000;

    // Conversion rate of mock A experiments
    CONVERSION_RATE_A = 0.05; // $("#conv").val();
  
    // Initialise experiment data.
    e = new Array();
    for (var i = 0; i < EXPERIMENTS; ++i) { e[i] = new Experiment(i); }
    
    score = 0; level = 0; time = TOTAL_VISITORS;
    next_round();
}

function next_round() {
    level++;
    
    $("#level").text((1/Math.pow(2,level-1)*100).toFixed(2) + "%");
    $("#score").text(score);
    $("#time").text(time.toLocaleString());
    
    CONVERSION_RATE_B = CONVERSION_RATE_A * (Math.random() < 0.5 ? (1+1/Math.pow(2,level-1)) : (1-1/Math.pow(2,level-1)));
    
    // Reset experiments.
    for (var i = 0; i < EXPERIMENTS; ++i) { e[i].reset(); }
    
    // Pick a winner.
    winner = Math.round(Math.random()*(EXPERIMENTS-1));
    e[winner].conversion_rates = [CONVERSION_RATE_A, CONVERSION_RATE_B];
}

function choose_exp(e) {
    if (time > 0) {
        if(winner==e) { 
            $("#"+winner).switchClass("", "correct", 100).switchClass( "correct", "", 100 );;
            score++; 
        } 
        else {
            $("#"+winner).switchClass("", "incorrect", 100).switchClass( "incorrect", "", 100 );;
            score--;
        }
    
        next_round();
    }
}

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
}

function run_experiments() {
    for (var i = 0; i < e.length; ++i) {
        e[i].run_sim(VISITORS_PER_DAY);
    }
}

function recursive_experiment_loop() {
    run_experiments();
    time -= VISITORS_PER_DAY;
    $("#time").text(time.toLocaleString());
    for (var i = 0; i < e.length; ++i) { e[i].paint_update(); }
    if (time > 0) timeoutID = window.setTimeout(recursive_experiment_loop, 100);
    if (time <= 0) {
        $(".message_box div.intro").hide();
        $(".message_box div.over").show();
        $("#perf_summary").text("You made " + (level-1) + " decisions and scored a total of " + score + " points." + (score>4?" That's awesome!":""));
        if (score > 6) {
            $(".over h1").text("You Can See The Matrix!")
            $("#perf_long").text("What you've achieved is statistically very improbable. You probably cheated, but you might also simply be The One. If you manage to do this a second time, we'd be very impressed.");
        }
        else if (level == 1) {
            $(".over h1").text("Paradox Of Choice, hmm?")
            $("#perf_long").text("Just remember that not making any decisions is also a choice. you might not have made any mistakes, but you've also not really added any value to the company. Perhaps you were sleeping?");
        }
        else if (level > 5 && score < 0) {
            $(".over h1").text("Not Quite Worse Than Random")
            $("#perf_long").text("Sure, you were decisive, but sometimes it is better to wait before you make a decision.");
        }
        else if (level > 1 && score == 0) {
            $(".over h1").text("You Win Some, You Lose Some")
            $("#perf_long").text("Maybe play again and stick to making good decisions only, hmkay?");
        }
        else if (score > 2 && score <= 4) {
            $(".over h1").text("Great Job, No Really")
            $("#perf_long").text("This is not an easy game. You should be proud you managed to get a positive score.");
        }
        else if (score == 5 && level < 7) {
            $(".over h1").text("That's Awesome! Can You Do Better?")
            $("#perf_long").text("This is a very good score! Looks like you made all the right choices, but perhaps you can do even better than this if you make all the right choices just a little bit faster?");
        }
        else if (score == 5 && level >= 7) {
            $(".over h1").text("Easy Does It")
            $("#perf_long").text("This is a very good score! Looks like you made a few costly mistakes along the way. Perhaps you can do better if you wait just a little bit longer when you're not quite confident you're making the right decision?");
        }
        else if (score == 6) {
            $(".over h1").text("Best Probable Score. Seriously.")
            $("#perf_long").text("We've done the math, and the odds of getting a score even higher than this are absolutely astronomically small. This is as close as you'll ever be to beating this game, but perhaps you'd like to try just one more time?");
        }
        else {
            $(".over h1").text("Okay, I Guess")
            $("#perf_long").text("Keep in mind that this game is all about a trade off. You cannot win, but you can probably do better.");
        }
        
        $(".message_box").show();
    }
}

function paint_experiments() {
    var c = $(".experiments");
    c.empty();
    for (var i = 0; i < e.length; ++i) {
        c.append(e[i].paint());
    }

    $("table").click(function(e){choose_exp($(this).attr("id"));});
}

function start_game() {
    $(".message_box").hide();
    init();
    paint_experiments();
    recursive_experiment_loop();
}

$(document).ready(function() {
    document.addEventListener('keydown', function(event) {
        if(event.keyCode >= 48 && event.keyCode <= 57) {
            choose_exp(event.keyCode-48);
        }
    });
    
    $(".start_button").click(function(e){start_game()});
    $(".message_box div.over").hide();

    init();
    paint_experiments();
});
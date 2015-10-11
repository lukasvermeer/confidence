//
// Decision making under uncertainty is complicated business. This game aims to make 
// decision makers more aware of the complex trade off between indecision and acting 
// on insufficient information.
//

P_VALUE = 0.1;
GTEST_CUTOFF = chisqrdistr(1, P_VALUE);
EXPERIMENTS     = 10;
VARIANTS        = 2;
VISITORS_PER_DAY_ARCADE = 1000;
VISITORS_PER_DAY_SIM = 1000000;
TOTAL_VISITORS = 500000;
TOTAL_DAYS = 28;
CONVERSION_RATE = 0.05;
AVERAGE_EFFECT = -0.05;
AVERAGE_EFFECT_STDDEV = 0.5;
DEV_CAPACITY = 2;

var e, score, level, time;

function next_round_arcade() {
    level++;
    
    $('#level').text((1/Math.pow(2,level-1)*100).toFixed(2) + '%');
    $('#score').text(score);
    $('#time').text(time.toLocaleString());
    
    // Pick a winner.
    winner = Math.round(Math.random()*(EXPERIMENTS-1));
    effect = (Math.random() < 0.5 ? (1+1/Math.pow(2,level-1)) : (1-1/Math.pow(2,level-1)));
    
    // Reset experiments.
    for (var i = 0; i < EXPERIMENTS; ++i) { e[i].reset(winner == i ? effect : 1); }
}

function next_round_sim() {
    if (day < TOTAL_DAYS) {
        $(".waiting").show();
        setTimeout(function() { next_round_sim_deferred();}, 1);
    }
}

function next_round_sim_deferred() {
    run_experiments(VISITORS_PER_DAY_SIM);
    day++;
    
    $('#conversion').text((conversion*100).toFixed(2) + '%');
    $('#conversions').text(conversions.toFixed().replace(/\d(?=(\d{3})+$)/g, '$&.'));
    $('#day').text(day + '/' + TOTAL_DAYS);
    
    var dc = DEV_CAPACITY;
    
    for (var i = 0; i < e.length; ++i) { 
        if (e[i].active) {
            e[i].days++;
            e[i].paint_update(); 
            $('#'+i+' .exp_box_overlay').hide();
            $('#'+i+' .exp_box_hoverlay').show();
        }
        else {
            if (dc > 0) {
                e[i].reset(1 + (normRand() * AVERAGE_EFFECT_STDDEV + AVERAGE_EFFECT) / 100);
                $('#'+i+' .exp_box_overlay .feedback').show().html('New experiment started.<br />Data available tomorrow.');
                dc--;
            }
            else {
                $('#'+i+' .exp_box_overlay .feedback').show().html('Prioritised on backlog.<br />No development capacity.');
            }
        }
    }
    $(".waiting").hide();
}

function sim_visitor() {
    var c = conversion;
    
    // assign to treatment for each exp and calculate aggregate effect size.
    var a = [];
    for (var i = 0; i < e.length; ++i) {
        a[i] = e[i].assign_variant();
        c = c * e[i].effect[a[i]];
    }
    
    // converted or not.
    b = false; if (Math.random() <= c) { b = true; conversions++; }

    // update exps to reflect.
    for (var i = 0; i < e.length; ++i) {
        if (e[i].active) {
            e[i].visits[a[i]]++;
            if (b) e[i].conversions[a[i]]++;
        }
    }
}

function run_experiments(v) {
    for (var i = 0; i < v; ++i) { sim_visitor(); }
}

function recursive_experiment_loop() {
    run_experiments(VISITORS_PER_DAY_ARCADE);
    time -= VISITORS_PER_DAY_ARCADE;
    $('#time').text(time.toLocaleString());
    for (var i = 0; i < e.length; ++i) { e[i].paint_update(); }
    if (time > 0) timeoutID = window.setTimeout(recursive_experiment_loop, 10);
    if (time <= 0) { end_game(); }
}

function paint_experiments() {
    var c = $('.experiments'); c.empty();
    for (var i = 0; i < e.length; ++i) { c.append(e[i].paint()); }
    $('.exp_box_hoverlay').click(function(e) { choose_exp($(this).parent().attr('id')); } );
    $('.exp_box_hoverlay .fo').click(function(e) { sim_choose_exp($(this).parent().parent().attr('id'), true); } );
    $('.exp_box_hoverlay .stop').click(function(e) { sim_choose_exp($(this).parent().parent().attr('id'), false); } );
}

function start_arcade_game() {
    $('.message_box').hide();
    $('.exp_box_hoverlay').show();
    $('.sim').hide();
    $('.arcade').show();

    // Initialise experiment data.
    e = new Array();
    for (var i = 0; i < EXPERIMENTS; ++i) { e[i] = new Experiment(i); }
    score = 0; level = 0; time = TOTAL_VISITORS; conversion = CONVERSION_RATE;
    
    next_round_arcade();
    paint_experiments(); 
    $('.sim').hide(); // extra hide because repaint. ugly. :-/
    recursive_experiment_loop();
}

function start_sim_game() {
    $('.message_box').hide();
    $('.exp_box_hoverlay').show();
    $('.sim').show();
    $('.arcade').hide();

    // Initialise experiment data.
    e = new Array();
    for (var i = 0; i < EXPERIMENTS; ++i) { e[i] = new Experiment(i); }
    for (var i = 0; i < EXPERIMENTS; ++i) { e[i].reset(1 + (normRand() * AVERAGE_EFFECT_STDDEV + AVERAGE_EFFECT) / 100); }

    conversions = 0; day = 0; conversion = CONVERSION_RATE;

    paint_experiments();
    next_round_sim();
}

function choose_exp(e) {
    if (time > 0) {
        if(winner==e) { 
            $('#'+winner+' .exp_box_hoverlay').switchClass('', 'correct', 100).switchClass( 'correct', '', 250 );;
            score++; 
        } 
        else {
            $('#'+winner+' .exp_box_hoverlay').switchClass('', 'incorrect', 100).switchClass( 'incorrect', '', 250 );;
            score--;
        }
    
        next_round_arcade();
    }
}

function sim_choose_exp(exp, fullon) {
    // apply change to conversion
    if (fullon) { conversion = e[exp].effect[1] * conversion; }
    $('#conversion').text((conversion*100).toFixed(2) + '%');
    // block for remainder of the round
    $('#'+exp+' .exp_box_hoverlay').hide()
    // provide more feedback
    $('#'+exp+' .exp_box_overlay').show()
    $('#'+exp+' .exp_box_overlay .feedback').show().html('You decided to '+ (fullon ? 'put full on' : 'stop')+' this experiment.<br />The real effect of this experiment was '+((e[exp].effect[1]-1)*100).toFixed(2)+'%.');
    // reset experiment
    e[exp].end_experiment();
    if (!fullon && e[exp].days == 1) {
        $('.instant_kill').show('scale', { percent: 100 }, 300).fadeOut();
    }
    else if (!fullon && e[exp].days > 1) {
        $('.fatality').show('scale', { percent: 100 }, 300).fadeOut();
    }
    if (fullon && e[exp].get_conversion(1) < e[exp].get_conversion(0) && e[exp].is_significant()) {
        $('.hurting').show('scale', { percent: 100 }, 300).fadeOut();
    }
    else if (fullon && e[exp].get_conversion(1) > e[exp].get_conversion(0) && !e[exp].is_significant()) {
        $('.just_under_conclusivity').show('scale', { percent: 100 }, 300).fadeOut();
    }
    else if (fullon && e[exp].get_conversion(1) > e[exp].get_conversion(0) && e[exp].is_significant() && e[exp].effect[1] <= 1) {
        $('.false_positive').show('scale', { percent: 100 }, 300).fadeOut();
    }
}

function end_game() {
    $('.message_box div').hide();
    $('.exp_box_overlay').hide();
    $('.exp_box_hoverlay').hide();
    $('.message_box').show();
    $('.message_box div.over').show();
    $('#perf_summary').text('You made ' + (level-1) + ' decisions and scored a total of ' + score + ' points.' + (score>4?' That\'s awesome!':''));
    if (score > 6) {
        $('.over h1').text('You Can See The Matrix!')
        $('#perf_long').text('What you\'ve achieved is statistically very improbable. You probably cheated, but you might also simply be The One. If you manage to do this a second time, we\'d be very impressed.');
    }
    else if (level == 1) {
        $('.over h1').text('Paradox Of Choice, hmm?')
        $('#perf_long').text('Just remember that not making any decisions is also a choice. you might not have made any mistakes, but you\'ve also not really added any value to the company. Perhaps you were sleeping?');
    }
    else if (level > 5 && score < 0) {
        $('.over h1').text('Not Quite Worse Than Random')
        $('#perf_long').text('Sure, you were decisive, but sometimes it is better to wait before you make a decision.');
    }
    else if (level > 1 && score == 0) {
        $('.over h1').text('You Win Some, You Lose Some')
        $('#perf_long').text('Maybe play again and stick to making good decisions only, hmkay?');
    }
    else if (score > 2 && score <= 4) {
        $('.over h1').text('Great Job, No Really')
        $('#perf_long').text('This is not an easy game. You should be proud you managed to get a positive score.');
    }
    else if (score == 5 && level < 7) {
        $('.over h1').text('That\'s Awesome! Can You Do Better?')
        $('#perf_long').text('This is a very good score! Looks like you made all the right choices, but perhaps you can do even better than this if you make all the right choices just a little bit faster?');
    }
    else if (score == 5 && level >= 7) {
        $('.over h1').text('Easy Does It')
        $('#perf_long').text('This is a very good score! Looks like you made a few costly mistakes along the way. Perhaps you can do better if you wait just a little bit longer when you\'re not quite confident you\'re making the right decision?');
    }
    else if (score == 6) {
        $('.over h1').text('Best Probable Score. Seriously.')
        $('#perf_long').text('We\'ve done the math, and the odds of getting a score even higher than this are absolutely astronomically small. This is as close as you\'ll ever be to beating this game, but perhaps you\'d like to try just one more time?');
    }
    else {
        $('.over h1').text('Okay, I Guess')
        $('#perf_long').text('Keep in mind that this game is all about a trade off. You cannot win, but you can probably do better.');
    }
}

// Returns normally distributed random numbers
function normRand() {
    var x1, x2, rad;
 
    do {
        x1 = 2 * Math.random() - 1;
        x2 = 2 * Math.random() - 1;
        rad = x1 * x1 + x2 * x2;
    } while(rad >= 1 || rad == 0);
 
    var c = Math.sqrt(-2 * Math.log(rad) / rad);
 
    return x1 * c;
};

$(document).ready(function() {
    document.addEventListener('keydown', function(event) {
        if(event.keyCode >= 48 && event.keyCode <= 57) {
            choose_exp(event.keyCode-48);
        }
        if(event.keyCode == 32) {
            next_round_sim();
        }
    });
    $('.sim').hide();
    $('.arcade').hide();

    $('.message_box div').hide();
    $('.message_box div.intro').show();

    $('.button.arcade_mode').click(function(e){
        $('.message_box div').hide();
        $('.message_box div.arcade_intro').show();
    });
    $('.button.arcade_start').click(function(e){ start_arcade_game(); });
    $('.button.sim_mode').click(function(e){
        $('.message_box div').hide();
        $('.message_box div.sim_intro').show();
    });
    $('.button.sim_start').click(function(e){ start_sim_game(); });

    $('.button.reset').click(function(e){
        $('.message_box div').hide();
        $('.message_box div.intro').show();
    });

    $('.button.next.sim').click(function(e){
        next_round_sim();
    });
    
    $(".waiting").hide()
    $(".wham").hide()
    //start_sim_game();
});
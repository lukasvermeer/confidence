P_VALUE = 0.1;
GTEST_CUTOFF = chisqrdistr(1, P_VALUE);
VARIANTS = 2;

var e;

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

function setValues(t,bc,vt,vc) {
    $("#base_traffic").val(t);
    $("#base_conversions").val(bc);
    $("#var_traffic").val(vt);
    $("#var_conversions").val(vc);
    show_results();
}

function show_results() {
    e = new Experiment(0);
    b_traffic = parseInt($("#base_traffic").val());
    v_traffic = parseInt($("#var_traffic").val());
    
    b_conv = parseInt($("#base_conversions").val());
    v_conv = parseInt($("#var_conversions").val());
    
    e.visits = [b_traffic,v_traffic];
    e.conversions = [b_conv, v_conv];
    
    $("#experiment").empty().append(e.paint());
    e.paint_update();
}

$(document).ready(function() {
    show_results();
    $(document).on("change, keyup", "#base_traffic", show_results);
    $(document).on("change, keyup", "#base_conversions", show_results);
    $(document).on("change, keyup", "#var_traffic", show_results);
    $(document).on("change, keyup", "#var_conversions", show_results);
});
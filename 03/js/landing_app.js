$.unserialize = function(serializedString) {
    var str = decodeURI(serializedString);
    var pairs = str.split('&');
    var obj = {}, p, idx, val;
    for (var i = 0, n = pairs.length; i < n; i++) {
        p = pairs[i].split('=');
        idx = p[0];

        if (idx.indexOf("[]") == (idx.length - 2)) {
            // Eh um vetor
            var ind = idx.substring(0, idx.length - 2)
            if (obj[ind] === undefined) {
                obj[ind] = [];
            }
            obj[ind].push(p[1]);
        }
        else {
            obj[idx] = p[1];
        }
    }
    return obj;
};
var landing_app = function($, prefix){
    
    var vars = {
        loader: '<img src="'+prefix+'images/loading.gif" alt=" ">',
        le: typeof landing_editor != 'undefined' && landing_editor,
        forms_timeout : []
    };
    
    function createCookie(name, value, days) {
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            var expires = "; expires=" + date.toGMTString();
        }
        else
            var expires = "";
        document.cookie = name + "=" + value + expires + "; path="+prefix;
    }

    function readCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ')
                c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) == 0)
                return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    function eraseCookie(name){
        createCookie(name, '', -1);
    }
    
    function init_datepicker(el_selector){
        if(!vars.le && typeof $.fn.datetimepicker != 'undefined'){
            var $this = $(el_selector);
            var now_as_min_date = !!$this.attr('data-now_as_min_date');
            var use_current = !!$this.attr('data-use_current');
            var lang = $this.attr('data-lang');
            var init = function(){
                $this.datetimepicker({
                    locale: lang,
                    useCurrent: false,
                    defaultDate: use_current ? new Date() : false,
                    format: 'YYYY-MM-DD HH:mm',
                    minDate: now_as_min_date ? new Date() : false
                });
            };
            if(vars.datepicker_language_loaded || lang == 'en'){
                init();
            }else{
                $.getScript(prefix+'extra/datetimepicker/bootstrap-datetimepicker.'+lang+'.js', function(){
                    vars.datepicker_language_loaded = true;
                    init();
                });
            }
        }
    }
    
    var captcha = [];
    function initCaptcha($el, key){
        $el.removeClass('hidden');
        if(!$el.hasClass('has-captcha')){
            $el.addClass('has-captcha');
            var id = (new Date()).getTime();
            $el.data('captcha', id);
            captcha[id] = grecaptcha.render($el[0], {
                sitekey : key
            });
        }
    }
    
    function removeCaptcha($el){
        if($el.hasClass('has-captcha')){
            grecaptcha.reset(captcha[$el.data('captcha')]);
            $el.addClass('hidden');
        }
    }
    
    function init_forms(){
        var $forms = $('.land_form');
        $forms.each(function(){
            var $this = $(this),
                id = $this.data('id');
            var forms_data = readCookie('form_data_'+id);
            if(forms_data){
                var string = decodeURIComponent(forms_data); // decodeURIComponent
                var data_obj = $.unserialize(string);
                $.each(data_obj, function(k,v){
                    if(k != 'hash' && typeof v == 'string'){
                        // TODO
                        v = v.replace("%40", "@");
                        $forms.find('[name="'+k+'"]').val($.trim(v));
                    }
                });
            }
            $this.find('.form_datepicker').each(function(){
                init_datepicker(this);
            });
        });
        $(document).on('keyup', '.land_form input, .land_form textarea', function() {
            var $this = $(this).parents('form'),
                id = $this.attr('action').replace(prefix+'ajax_land_form.php?form=', '');
            createCookie('form_data_' + id, encodeURIComponent($this.serialize().replace(/\+/g,"%20"))); // encodeURIComponent
        });
        $forms.on('submit', function(e){
            e.preventDefault();
            var $form = $(this),
                $form_msg = $form.find('.form_msg'),
                $submit = $form.find(':submit'),
                $formActions = $form.find('.form-actions'),
                action = $form.attr('action'),
                id = $form.data('id'),
                data = $form.serialize();
            $submit.attr('disabled', true);
            $form_msg.show().html(vars.loader);
            $.ajax({
                url: action,
                data: data,
                type: $form.attr('method'),
                dataType: 'JSON',
                success: function(data){
                    $submit.attr('disabled', false);
                    $form_msg.empty();
                    $form_msg.html(data.msg);
                    if ($form_msg.is(':hidden')) {
                        $form_msg.stop(true).fadeIn(200);
                    }
                    clearTimeout(vars.forms_timeout[id]);
                    if (data.state) {
                        push_to_ga('form_'+id+'_submit_success');
                        if(data.fb_conversion_code){
                            $('body').append(data.fb_conversion_code);
                        }
                        if(data.redirect){
                            window.location = data.redirect;
                        }
                        $form_msg.removeClass('text-danger');
                        $form.find(':text, textarea, input[type=tel], input[type=email]').val('');
                        $form.find(':radio,:checkbox').attr('checked',false);
                        eraseCookie('form_data_' + id);
                        setTimeout(function() {
                            $form_msg.stop(true).fadeOut(200);
                        }, 7000);
                        if(typeof comebacker != 'undefined'){
                            comebacker.user_make_request();
                            window.onbeforeunload = null;
                        }
                    } else {
                        push_to_ga('form_'+id+'_submit_fail');
                        $form_msg.addClass('text-danger');
                        if (typeof vars.forms_timeout[id] == 'undefined') {
                            vars.forms_timeout[id] = [];
                        }
                        vars.forms_timeout[id] = setTimeout(function() {
                            $form_msg.stop(true).fadeOut(200);
                        }, 5000);
                    }
                    
                    if(data.captcha){
                        if('grecaptcha' in window){
                            initCaptcha($formActions, data.captcha);
                        }else{
                            $.getScript("https://www.google.com/recaptcha/api.js?render=explicit").done(function(){
                                var load_i = setInterval(function(){
                                    if('grecaptcha' in window){
                                        clearInterval(load_i);
                                        initCaptcha($formActions, data.captcha);
                                    }
                                }, 15);
                            });
                        }
                    }else{
                        removeCaptcha($formActions);
                    }
                }
            });
        });
    }
    
    function push_to_ga(link){
        if(typeof(ga) == 'function'){
            ga('send', 'pageview', {page: prefix+link, title: document.title});
        }else if(typeof(_gaq) != 'undefined'){
            _gaq.push(['_trackPageview', prefix+link]);
        }
        if(typeof yaCounter != 'undefined'){
            yaCounter.reachGoal(link);
        }
    }
    
    return {
        createCookie: createCookie,
        readCookie: readCookie,
        eraseCookie: eraseCookie,
        push_to_ga: push_to_ga,
        init: function(){
            init_forms();
        }
    };
    
}($, prefix);

$(function(){
    landing_app.init();
});

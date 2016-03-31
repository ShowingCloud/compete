// Initialize the app
var myApp = new Framework7();

// Export selectors engine
var $$ = Dom7;

// Add view
var mainView = myApp.addView('.view-main', {
    animatePages: false //disable animated transitions between pages
});

//Initialize PouchDB
var scoreDB = new PouchDB("score", {
    adapter: 'websql'
    , location: 2
});
var msgDB = new PouchDB("msg", {
    adapter: 'websql'
    , location: 2
});
//Not use remote PouchDb server
var remoteCouch = false;

// apption for app
var appOption = {
    serverHost: "http://dev.domelab.com"
};

var temp = {};

var judgeInfo = {};

var app = {
    init: function () {
        //Globle ajax error handller
        $$(document).on('ajaxError', function (e) {
            var xhr = e.detail.xhr;
            console.log(xhr);
            if (xhr.status === 401) {
                myApp.alert("登陆失效，请重新登陆", "");
            }
        });
        app.getProcess();
        //Check local judge data exciting
        var tempStr;
        tempStr = localStorage.getItem("judgeInfo");
        if (typeof (tempStr) === "string") {
            judgeInfo = JSON.parse(tempStr);
            app.showJudge(judgeInfo);
            app.onLogin(judgeInfo.authToken);
        } else {
            app.login();
        }

    }
    , login: function () {
        $$("#login-btn").off('click');
        String.prototype.getParam = function (str) {
                str = str.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
                var regex = new RegExp("[\\?&]*" + str + "=([^&#]*)");
                var results = regex.exec(this);
                if (results == null) {
                    return "";
                } else {
                    return results[1];
                }
            }
            //Oauth2 job 
        document.addEventListener("deviceready", function () {
            var options = {
                auth_url: 'http://dev.domelab.com/auth/login/authorize'
                , token_url: 'http://dev.domelab.com/auth/login/access_token'
                , client_id: '1'
                , client_secret: '123456'
                , redirect_uri: 'http://dev.domelab.com'
            }

            //Generate Login URL
            var paramObj = {
                client_id: options.client_id
                , redirect_uri: options.redirect_uri
                , response_type: options.response_type
            };
            var login_url = options.auth_url + '?' + $$.serializeObject(paramObj);
            //Open an inappbrowser but not show it to user
            var ref = window.open(login_url, "_blank", "hidden=yes,clearcache=yes");
            var count = 0;
            ref.addEventListener('loadstart', function (e) {
                var url = e.url;
                url = url.split("#")[0];

                var code = url.getParam("code");
                if (code) {
                    ref.close();
                    //Get access token
                    $$.ajax({
                        url: options.token_url
                        , data: {
                            code: code
                            , client_id: options.client_id
                            , client_secret: options.client_secret
                            , redirect_uri: options.redirect_uri
                            , grant_type: "authorization_code"
                        }
                        , method: 'POST'
                        , success: function (data) {
                            //Get userInfo
                            var dataObj = JSON.parse(data);
                            $$.getJSON('http://dev.domelab.com/auth/login/user', {
                                oauth_token: dataObj.access_token
                            }, function (d) {
                                console.log(d);
                                if ((d instanceof Object)) {
                                    var judgeInfo = {
                                        userId: d.id
                                        , email: d.info.email
                                        , nickname: d.extra.nickname
                                        , authToken: d.info.private_token
                                    };
                                    localStorage.setItem("judgeInfo", JSON.stringify(judgeInfo));
                                    console.log('userInfo saved!');
                                    app.showJudge(judgeInfo);
                                    app.onLogin(judgeInfo.authToken);

                                }
                            });
                        }
                        , error: function (error) {
                            console.log(error);
                        }
                    });
                }
            });
            ref.addEventListener('loadstop', function (e) {
                if (e.url === "http://dev.domelab.com/account/sign_in") {
                    if (!count) {
                        count++;
                        myApp.alert("请登录", "");
                        $$("#login-btn").on('click', function () {
                            var username = $$("#username").val();
                            var password = $$("#password").val();
                            if (typeof username === "string" && typeof password === "string") {
                                //Inject script to inappbrowser to submit the login form
                                var script = "document.getElementById('user_login').value='" + username + "';" + "document.getElementById('user_password').value='" + password + "';" + "document.getElementById('new_user').submit();"
                                ref.executeScript({
                                    code: script
                                }, function (values) {
                                    console.log(values);
                                });
                            } else {
                                myApp.alert("请输入用户名和密码", "");
                            }
                        });
                    } else {
                        myApp.alert("错误，请重新登录", "");
                    }
                }

            });

        });
    }
    , bind: function () {


    }
    , onLogin: function (token) {
        //get realtime message
        app.getMessage(token);
        //logout
        $$("#logout-btn").on("click", function (token) {
            var channel = "/channel/" + token;
            localStorage.removeItem("judgeInfo");
            MessageBus.unsubscribe(channel, function () {
                console("unsubscribe");
            });
            MessageBus.stop();
            $$("#judge-info").hide();
            $$("#login-container").show();
            app.login();
        });

        myApp.onPageInit('player', function (page) {
            $$("#getPlyaer").off("click").on("click", function () {
                var playerId = $$("#playerId").val();
                if (playerId) {
                    $$.getJSON("http://dev.domelab.com/api/v1/users/" + token + "/team_players", {
                        identifier: playerId
                    }, function (data) {
                        console.log(data);
                        if (data.user.length === 0) {
                            myApp.alert("没有此人信息")
                            return;
                        }
                        if (data.user.length === 1) {
                            var player = data.user[0];
                            player.eventName = temp.compete.name + "-" + temp.event.name;
                            var playerTemp = $$('#playerTemp').html();
                            var compiledTemp = Template7.compile(playerTemp);
                            temp.playerInfo = compiledTemp(player);
                            console.log(temp);
                            mainView.router.loadPage('stopWatch.html');
                        } else {
                            var team = data;
                            team.eventName = temp.compete.name + "-" + temp.event.name;
                            var teamTemp = $$('#teamTemp').html();
                            var compiledTemp = Template7.compile(teamTemp);
                            temp.playerInfo = compiledTemp(player);
                            mainView.router.loadPage('player.html');
                        }
                    });
                } else {
                    myApp.alert("请输入选手编号", "");
                }
            });
        });
    }
    , showJudge: function (judge) {
        console.log(judge);
        $$("#judgeId").text(judge.userId);
        $$("#judgeName").text(judge.nickname);
        $$("#login-container").hide();
        $$("#judge-info").show();
    }
    , getProcess: function () {
        $$.getJSON("http://dev.domelab.com/api/v1/competitions", function (process) {
            console.log(process);
            var processTemp = $$('#processTemp').html();
            var compiledTemp = Template7.compile(processTemp);
            var html = compiledTemp(process);
            $$("#homePage .page-content").append(html);
        });
    }
    , getResponse: function () {
        $$.getJSON("./data/response.json", function (response) {
            $$("#judgeComptition").val(response.compition);
            $$("#judgeEvent").val(response.events.toString());
        });
    }
    , getMessage: function (token) {
        //Get unread counts
        $$.getJSON("http://dev.domelab.com/api/v1/users/" + token + "/notifications/unread ", function (unread) {
            console.log(unread);
            $$("#msg").addClass("newMsg");
        });
        //Subscribe message
        var channel = "/channel/" + token;
        MessageBus.start();
        MessageBus.callbackInterval = 500;
        MessageBus.subscribe(channel, function (d) {
            console.log(d);
            $$("#msgBoard ul").append("<li><p class='time'>" + d.time + "</p><p class='content'>" +
                d.content + "</p></li>");
            $$("#msg").addClass("newMsg");
        });

    }
    , submitScore: function () {
        var formData = {};
        var remark;
        //Get scores
        $$(".score").each(function (i, obj) {
            var _this = $$(this);
            var value = _this.text();
            var name = _this.attr('name');
            if (value) {
                formData[name] = value;
            } else {
                myApp.alert("分数未填写完整");
                return;
            }
        });
        //Get remark
        remark = $$("#remark").val();
        if (remark) {
            formData.remark = remark;
        }
        //Get signature
        var canvas = document.getElementById("canvas");
        canvas.toBlob(function (blob) {
            formData.signature = blob
        }, "image/jpeg", 0.95);

        console.log(formData);
    }
};

myApp.onPageBeforeInit('home', function (page) {
    app.showJudge(judgeInfo);
    app.getProcess();
});

myApp.onPageBeforeRemove('home', function (page) {
    console.log("remove home");
});

myApp.onPageInit('select', function (page) {
    $$("#eventsBoard .tab div").on("click", function () {
        var compete = {
            id: $$(".compete-select .active").data("id")
            , name: $$(".compete-select .active").text()
        };
        var event = {
            id: $$(this).data("id")
            , name: $$(this).text()
        }
        temp.compete = compete;
        temp.event = event;
        mainView.router.loadPage('player.html');
    });
});

myApp.onPageInit('msg', function (page) {
    $$("#msg").removeClass("newMsg");
});

myApp.onPageInit('stopWatch', function (page) {
    //var thisEvent = events[temp.event.id];
    $$(".playerInfo").append(temp.playerInfo);

    var mySwiper = myApp.swiper('.swiper-container', {
        pagination: '.swiper-pagination'
        , paginationHide: false
        , paginationClickable: true
    });

    var Stopwatch = function () {
        var startAt = 0;
        var lapTime = 0;

        var now = function () {
            return (new Date()).getTime();
        };

        this.start = function () {
            startAt = startAt ? startAt : now();
        };

        this.stop = function () {
            lapTime = startAt ? lapTime + now() - startAt : lapTime;
            startAt = 0;
        };

        this.reset = function () {
            lapTime = startAt = 0;
        };

        this.time = function () {
            return lapTime + (startAt ? now() - startAt : 0);
        };
    };
    var x = new Stopwatch();
    var $time;
    var clocktimer;
    var total;
    var timeLimit = 5000;

    var timeoutHander = function () {
        myApp.alert("已超时", "");
    };

    function pad(num, size) {
        var a = num;
        if (a.toString().length > size) {
            return a.toString().substring(0, size);
        } else {
            var s = "0000" + num;
            return s.substr(s.length - size);
        }

    }

    function formatTime(time) {
        var h = m = s = ms = 0;
        var newTime = '';

        time = time % (60 * 60 * 1000);
        m = Math.floor(time / (60 * 1000));
        time = time % (60 * 1000);
        s = Math.floor(time / 1000);
        ms = time % 1000;

        newTime = pad(m, 2) + ':' + pad(s, 2) + ':' + pad(ms, 2);
        return newTime;
    }

    function show() {
        $time = document.getElementById('time');
        update();
    }

    function update() {
        var timeNow = x.time();

        if (timeNow >= timeLimit) {
            stop();
            $time.innerHTML = formatTime(timeLimit);
            timeoutHander();
        } else {
            $time.innerHTML = formatTime(timeNow);
        }
    }

    function start() {
        clocktimer = setInterval(update, 1);
        x.start();
        $$("#start").text("停止");
        document.getElementById('start').onclick = stop;
    }

    function stop() {
        x.stop();
        clearInterval(clocktimer);
        document.getElementById('start').onclick = start;
        $$("#start").text("开始");
    }

    function reset() {
        stop();
        x.reset();
        update();
    }

    function record() {
        stop();
        var elements = document.getElementsByClassName("timeScore");
        for (var i = 0; i < elements.length; i++) {
            if (!elements[i].innerHTML) {
                elements[i].innerHTML = $time.innerHTML;
                if (i === elements.length - 1) {
                    reset();
                    document.getElementById('start').onclick = document.getElementById('reset').onclick = document.getElementById('record').onclick = null;

                    total = 0;
                    for (var i = 0; i < elements.length; i++) {
                        total = total + unformat(elements[i].innerHTML);
                    }
                    console.log(total);
                    document.getElementById('finalScore').innerHTML = formatTime(total);
                }
                break;
            }
        }
        x.reset();
    }

    function unformat(data) {
        var a = data.split(":");
        return a[0] * 60 * 1000 + a[1] * 1000 + a[2] * 10;
    }

    show();

    document.getElementById('start').onclick = start;
    document.getElementById('reset').onclick = reset;
    document.getElementById('record').onclick = record;


    var canvas = document.getElementById('canvas');
    var context = canvas.getContext("2d");
    canvas.addEventListener("touchstart", touchStartHandler, false);
    canvas.addEventListener("touchmove", touchMoveHandler, false);
    canvas.addEventListener("touchend", touchEndHandler, false);
    document.getElementById("clearCanvas").onclick = function () {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        clickX = [];
        clickY = [];
        clickDrag = [];
    };

    function touchStartHandler(e) {
        e.preventDefault();
        var touchEvent = e.changedTouches[0];
        paint = true;
        addClick(touchEvent.clientX - $$("#canvas").offset().left, touchEvent.clientY - $$("#canvas").offset().top);
        redraw();
    }

    function touchMoveHandler(e) {
        e.preventDefault();
        var touchEvent = e.changedTouches[0];
        console.log(touchEvent.pageX);
        if (paint) {
            addClick(touchEvent.clientX - $$("#canvas").offset().left, touchEvent.clientY - $$("#canvas").offset().top, true);
            redraw();
        }
    }

    function touchEndHandler(e) {
        e.preventDefault();
        paint = false;
    }

    var clickX = [];
    var clickY = [];
    var clickDrag = [];
    var paint;

    function addClick(x, y, dragging) {
        clickX.push(x);
        clickY.push(y);
        clickDrag.push(dragging);
    }

    function redraw() {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);

        context.strokeStyle = "#df4b26";
        context.lineJoin = "round";
        context.lineWidth = 3;

        for (var i = 0; i < clickX.length; i++) {
            context.beginPath();
            if (clickDrag[i] && i) {
                context.moveTo(clickX[i - 1], clickY[i - 1]);
            } else {
                context.moveTo(clickX[i] - 1, clickY[i]);
            }
            context.lineTo(clickX[i], clickY[i]);
            context.closePath();
            context.stroke();
        }
    }


});

app.init();
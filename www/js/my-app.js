// Initialize the app
var myApp = new Framework7();

// Export selectors engine
var $$ = Dom7;

// Add view
var mainView = myApp.addView('.view-main', {
    animatePages: false //disable animated transitions between pages
});

//Initialize PouchDB
var score = new PouchDB("score");
//Not use remote PouchDb server
var remoteCouch = false;

//parameters for app
var appPara = {
    serverHost: "http://dev.domelab.com"
};

var app = {
    init: function () {
        //Check local judge data exciting
        var tempStr, judgeInfo;
        tempStr = localStorage.getItem("judgeInfo");
        if (typeof (tempStr) === "string") {
            judgeInfo = JSON.parse(tempStr);
            app.showJudge(judgeInfo);
        } else {
            app.login();
        }
        //Globle ajax error handller
        $$(document).on('ajaxError', function (e) {
            var xhr = e.detail.xhr;
            console.log(xhr);
        });
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
            var ref = window.open(login_url, "_blank", "hidden=yes");
            var count = 0;
            ref.addEventListener('loadstart', function (e) {
                var url = e.url;
                url = url.split("#")[0];

                var code = url.getParam("code");
                if (code) {
                    ref.close();
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
                        alert("请登录");
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
                                alert("请输入用户名和密码");
                            }
                        });
                    } else {
                        alert("错误，请重新登录");
                    }
                }
                /*else if (e.url === "http://dev.domelab.com/auth/login/user") {
                                   //Get judgeInfo from the inappbrowser
                                   ref.executeScript({
                                           code: "document.getElementsByTagName('pre')[0].innerHTML"
                                       }
                                       , function (values) {
                                           console.log(values);
                                           if (typeof values[0] === "string") {
                                               var d = JSON.parse(values[0]);
                                               var judgeInfo = {
                                                   userId: d.id
                                                   , email: d.info.email
                                                   , nickname: d.extra.nickname
                                                   , authToken: d.info.private_token
                                               };
                                               localStorage.setItem("judgeInfo", JSON.stringify(judgeInfo));
                                               console.log('userInfo saved!');
                                               app.showJudge(judgeInfo);
                                               ref.close();
                                           }
                                       }
                                   );
                               }*/

            });

        });
    }
    , bind: function () {
        $$("#logout-btn").on("click", function () {
            localStorage.remove("judgeInfo");
            app.login();
        });
    }
    , onLogin: function () {
        //ToDo: get compete and events the judge responsible for 
        //ToDo: get competes process
        //ToDo: get detail about all the competes and events
    }
    , showJudge: function (judge) {
        console.log(judge);
        $$("#judgeId").text(judge.userId);
        $$("#judgeName").text(judge.nickname);
        $$("#login-container").hide();
        $$("#judge-info").show();
    }

};


myApp.onPageInit('score', function (page) {

});

myApp.onPageBeforeInit('score', function (page) {
    console.log('Before score page initialized');
    console.log(page);
});


app.init();
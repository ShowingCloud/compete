// Initialize your app
var myApp = new Framework7();

// Export selectors engine
var $$ = Dom7;

// Add view
var mainView = myApp.addView('.view-main', {
    // 
});

var appPara = {
    serverHost: "http://localhost:3000/"
};

var app = {
    init: function () {
        var tempStr, judgeInfo;
        tempStr = localStorage.getItem("judgeInfo");
        if (typeof (tempStr) === "string") {
            judgeInfo = JSON.parse(tempStr);
            app.showJudge(judgeInfo);
        } else {
            $$("#login-container").show();
        }
    }
    , showJudge: function (data) {
        console.log(data);
        //ToDo:JudgeInfo templete and append to judge-container



        $$("#login-container").hide();
        $$("judge-info").show();
    }

};
//Initialize PouchDB
var score = new PouchDB("score");
//Not use remote PouchDb server
var remoteCouch = false;

document.addEventListener("deviceready", function () {

    var ref = window.open("http://dev.domelab.com/auth/login/user", "_blank", "hidden=yes");
    var count = 0;
    ref.addEventListener('loadstop', function (e) {
        if (e.url === "http://dev.domelab.com/account/sign_in") {
            if (!count) {
                count++;
                alert("请登录");
                $$("#login-btn").on('click', function () {
                    var username = $$("#username").val();
                    var password = $$("#password").val();
                    if (typeof username === "string" && typeof password === "string") {
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
        } else if (e.url === "http://dev.domelab.com/auth/login/user") {
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
                    }
                }
            );
        }

    });

});


$$("#login-btn").on('click', function () {

});

$$(document).on('ajaxComplete', function (e) {
    var xhr = e.detail.xhr;
    console.log('request performed');
});
// Callbacks to run specific code for specific pages, for example for About page:
myApp.onPageInit('index-1', function (page) {
    alert("index11");
    // handle login 
    $$("#login-btn").on('click', function () {


        //        var username = $$("#username").val();
        //        var password = $$("#password").val();
        //        if (typeof username === "string" && typeof password === "string") {
        //            var postData = {
        //                name: username
        //                , password: password
        //            }
        //            $$.ajax({
        //                method: "POST"
        //                , contentType: "application/json"
        //                , url: appPara.host + "/account/sign_in"
        //                , data: JSON.stringify(postData)
        //                , success: function (d) {
        //                    console.log(d);
        //                    var judgeInfo = {
        //                        userId: d.id
        //                        , email: d.info.email
        //                        , nickname: d.extra.nickname
        //                        , authToken: d.info.private_token
        //                    };
        //                    localStorage.setItem("judgeInfo", JSON.stringify(judgeInfo));
        //                    console.log('userInfo saved!');
        //                    app.showjudge(judgeInfo);
        //                }
        //            });
        //        } else {
        //            alert("请输入用户名和密码");
        //        }
    });
});
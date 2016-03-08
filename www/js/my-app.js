// Initialize your app
var myApp = new Framework7();

// Export selectors engine
var $$ = Dom7;

// Add view
var mainView = myApp.addView('.view-main', {
    // Because we use fixed-through navbar we can enable dynamic navbar
    dynamicNavbar: true
});

var appPara = {
    serverHost = "http://localhost:3000/"
}

var app {
        init: function () {
            var tempStr, judgeInfo;
            tempStr = localStorage.getItem("judge");
            if (typeof (tempStr) === "string") {
                judge = JSON.parse(judgeInfo);
                showJudge(judge);
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

    }
    //Initialize PouchDB
var score = new PouchDB("score");
//Not use remote PouchDb server
var remoteCouch = false;

// Callbacks to run specific code for specific pages, for example for About page:
myApp.onPageInit('about', function (page) {

    // handle login 
    $$('＃login-btn').on('click', function () {
        var username = $$("#username").val();
        var password = $$("#password").val();
        if (typeof username === "string" && typeof password === "string") {
            $$.ajax({
                method: "POST"
                , url: appPara.host + "login"
                , success: function (d) {
                    console.log(d);
                    var judgeInfo = {
                        userId: d.id
                        , email: d.info.email
                        , nickname: d.extra.nickname
                        , authToken: d.info.private_token
                    };
                    localStorage.setItem("judgeInfo", JSON.stringify(judgeInfo));
                    console.log('userInfo saved!');
                    app.showjudge(judgeInfo);
                }
            });
        } else {
            alert("请输入用户名和密码");
        }
    });
});
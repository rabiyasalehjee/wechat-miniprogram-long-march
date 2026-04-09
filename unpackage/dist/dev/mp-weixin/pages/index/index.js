"use strict";
const common_vendor = require("../../common/vendor.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
  data() {
    return {
      todaysSteps: 0,
      totalStepsHistory: 0,
      stepTarget: 15e4,
      todayRank: "无",
      activeTab: "today",
      endDate: /* @__PURE__ */ new Date("2026-05-29T23:59:59"),
      leaderboard: [],
      leaderboardLoading: false,
      userNickname: "",
      userAvatarUrl: "",
      showProfileModal: false,
      tempNickname: "",
      tempAvatarUrl: "",
      pendingSyncCode: "",
      pendingSyncEncryptedData: "",
      pendingSyncIv: ""
    };
  },
  computed: {
    remainingSteps() {
      const rem = this.stepTarget - this.todaysSteps;
      return (rem > 0 ? rem : 0).toLocaleString();
    },
    daysLeft() {
      const now = /* @__PURE__ */ new Date();
      const diff = this.endDate - now;
      const days = Math.ceil(diff / (1e3 * 60 * 60 * 24));
      return days > 0 ? days : 0;
    }
  },
  mounted() {
    this.loadLocalData();
    const cached = common_vendor.index.getStorageSync("userProfile");
    if (cached && cached.nickname) {
      this.userNickname = cached.nickname;
      const av = cached.avatarUrl || "";
      this.userAvatarUrl = av.startsWith("cloud://") ? av : "";
    }
  },
  methods: {
    loadLocalData() {
      const savedSteps = common_vendor.index.getStorageSync("totalStepsHistory");
      if (savedSteps) {
        this.totalStepsHistory = parseInt(savedSteps, 10);
      }
      const savedToday = common_vendor.index.getStorageSync("todaysSteps");
      if (savedToday) {
        this.todaysSteps = parseInt(savedToday, 10);
      }
    },
    saveData() {
      common_vendor.index.setStorageSync("totalStepsHistory", this.totalStepsHistory);
      common_vendor.index.setStorageSync("todaysSteps", this.todaysSteps);
    },
    switchTab(tab) {
      this.activeTab = tab;
      if (tab === "period") {
        this.fetchLeaderboard();
      }
    },
    fetchLeaderboard() {
      this.leaderboardLoading = true;
      common_vendor.wx$1.cloud.callFunction({
        name: "getSteps",
        data: { action: "getLeaderboard" },
        success: (res) => {
          this.leaderboard = res.result.list || [];
          this.leaderboardLoading = false;
        },
        fail: (err) => {
          common_vendor.index.__f__("error", "at pages/index/index.vue:184", "Leaderboard fetch failed:", err);
          this.leaderboardLoading = false;
        }
      });
    },
    onChooseAvatar(e) {
      this.tempAvatarUrl = e.detail.avatarUrl;
    },
    onNicknameBlur(e) {
      if (e.detail.value)
        this.tempNickname = e.detail.value;
    },
    onNicknameChange(e) {
      this.tempNickname = e.detail.value;
    },
    confirmProfile() {
      const name = this.tempNickname.trim();
      if (!name) {
        common_vendor.index.showToast({ title: "请填写昵称", icon: "none" });
        return;
      }
      this.userNickname = name;
      this.showProfileModal = false;
      this.uploadAvatarAndSync(this.tempAvatarUrl, name);
    },
    cancelProfile() {
      this.showProfileModal = false;
    },
    syncWeRunData() {
      common_vendor.index.showLoading({ title: "准备中..." });
      if (this.userNickname) {
        this.startWeRunSync(this.userNickname, this.userAvatarUrl);
      } else {
        this.startWeRunSync("", "");
      }
    },
    startWeRunSync(nickname, avatarUrl) {
      const that = this;
      common_vendor.index.login({
        provider: "weixin",
        success: (loginRes) => {
          const code = loginRes.code;
          common_vendor.index.getWeRunData({
            success(res) {
              if (!that.userNickname) {
                common_vendor.index.hideLoading();
                that.pendingSyncCode = code;
                that.pendingSyncEncryptedData = res.encryptedData;
                that.pendingSyncIv = res.iv;
                that.showProfileModal = true;
              } else {
                that.sendToServer(code, res.encryptedData, res.iv, nickname, avatarUrl);
              }
            },
            fail(err) {
              common_vendor.index.hideLoading();
              common_vendor.index.showToast({ title: "读取数据失败", icon: "none" });
              common_vendor.index.__f__("error", "at pages/index/index.vue:240", err);
            }
          });
        },
        fail() {
          common_vendor.index.hideLoading();
          common_vendor.index.showToast({ title: "登录失败", icon: "none" });
        }
      });
    },
    uploadAvatarAndSync(localPath, nickname) {
      const that = this;
      if (!localPath) {
        that.doSync(nickname, "");
        return;
      }
      if (localPath.startsWith("http")) {
        common_vendor.index.showLoading({ title: "上传头像..." });
        common_vendor.index.downloadFile({
          url: localPath,
          success: (dlRes) => {
            that._uploadLocalFileAndSync(dlRes.tempFilePath, nickname);
          },
          fail: (err) => {
            common_vendor.index.__f__("error", "at pages/index/index.vue:266", "Avatar download failed:", err);
            common_vendor.index.hideLoading();
            that.doSync(nickname, "");
          }
        });
      } else {
        common_vendor.index.showLoading({ title: "上传头像..." });
        that._uploadLocalFileAndSync(localPath, nickname);
      }
    },
    _uploadLocalFileAndSync(localPath, nickname) {
      const that = this;
      const ext = localPath.split(".").pop().split("?")[0] || "jpg";
      const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      common_vendor.wx$1.cloud.uploadFile({
        cloudPath,
        filePath: localPath,
        success: (uploadRes) => {
          const cloudUrl = uploadRes.fileID;
          that.userAvatarUrl = cloudUrl;
          common_vendor.index.setStorageSync("userProfile", { nickname, avatarUrl: cloudUrl });
          common_vendor.index.hideLoading();
          that.doSync(nickname, cloudUrl);
        },
        fail: (err) => {
          common_vendor.index.__f__("error", "at pages/index/index.vue:291", "Avatar upload failed:", err);
          common_vendor.index.hideLoading();
          that.doSync(nickname, "");
        }
      });
    },
    doSync(nickname, avatarUrl) {
      this.sendToServer(this.pendingSyncCode, this.pendingSyncEncryptedData, this.pendingSyncIv, nickname, avatarUrl);
    },
    sendToServer(code, encryptedData, iv, nickname, avatarUrl) {
      const that = this;
      common_vendor.index.showLoading({ title: "读取中..." });
      common_vendor.wx$1.cloud.callFunction({
        name: "getSteps",
        data: { action: "syncSteps", code, encryptedData, iv, nickname, avatarUrl },
        success: (res) => {
          common_vendor.index.hideLoading();
          if (res.result && res.result.success) {
            that.todaysSteps = res.result.todaySteps;
            that.saveData();
            common_vendor.index.showToast({ title: "步数已更新！", icon: "success" });
          } else {
            common_vendor.index.showToast({ title: res.result.msg || "出错了，请重试", icon: "none" });
            common_vendor.index.__f__("error", "at pages/index/index.vue:314", "syncSteps failed:", res.result);
          }
        },
        fail: (err) => {
          common_vendor.index.hideLoading();
          common_vendor.index.showToast({ title: "同步失败，请重试", icon: "none" });
          common_vendor.index.__f__("error", "at pages/index/index.vue:320", "callFunction fail:", err);
        }
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return common_vendor.e({
    a: common_assets._imports_0,
    b: common_vendor.t($data.todaysSteps),
    c: common_vendor.t($data.todayRank),
    d: common_vendor.t($options.remainingSteps),
    e: common_vendor.o((...args) => $options.syncWeRunData && $options.syncWeRunData(...args)),
    f: $data.activeTab === "today"
  }, $data.activeTab === "today" ? {
    g: common_assets._imports_1,
    h: common_vendor.t($options.daysLeft)
  } : {}, {
    i: $data.activeTab === "period"
  }, $data.activeTab === "period" ? common_vendor.e({
    j: $data.leaderboardLoading
  }, $data.leaderboardLoading ? {} : common_vendor.e({
    k: common_vendor.f($data.leaderboard, (item, index, i0) => {
      return {
        a: common_vendor.t(index + 1),
        b: index < 3 ? 1 : "",
        c: item.avatarUrl || "/static/default-avatar.png",
        d: common_vendor.t(item.nickname || "微信用户"),
        e: common_vendor.t(item.todaySteps.toLocaleString()),
        f: item._openid
      };
    }),
    l: $data.leaderboard.length === 0
  }, $data.leaderboard.length === 0 ? {} : {})) : {}, {
    m: $data.activeTab === "today"
  }, $data.activeTab === "today" ? {} : {}, {
    n: common_vendor.o(($event) => $options.switchTab("today")),
    o: $data.activeTab === "period"
  }, $data.activeTab === "period" ? {} : {}, {
    p: common_vendor.o(($event) => $options.switchTab("period")),
    q: $data.showProfileModal
  }, $data.showProfileModal ? {
    r: $data.tempAvatarUrl || "/static/default-avatar.png",
    s: common_vendor.o((...args) => $options.onChooseAvatar && $options.onChooseAvatar(...args)),
    t: $data.tempNickname,
    v: common_vendor.o((...args) => $options.onNicknameBlur && $options.onNicknameBlur(...args)),
    w: common_vendor.o((...args) => $options.onNicknameChange && $options.onNicknameChange(...args)),
    x: common_vendor.o((...args) => $options.confirmProfile && $options.confirmProfile(...args)),
    y: common_vendor.o((...args) => $options.cancelProfile && $options.cancelProfile(...args))
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/index/index.js.map

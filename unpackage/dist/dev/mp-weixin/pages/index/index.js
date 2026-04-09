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
      pendingSyncIv: "",
      // Map check points (1 to 13 based on the Long March route)
      checkpoints: [
        { x: 85, y: 80 },
        // 1. Ruijin
        { x: 65, y: 84 },
        // 2. 
        { x: 50, y: 73 },
        // 3. (Moved up by roughly 3%)
        { x: 36, y: 68 },
        // 4. 
        { x: 25, y: 75 },
        // 5. 
        { x: 15, y: 65 },
        // 6. 
        { x: 22, y: 56 },
        // 7. 
        { x: 15, y: 48 },
        // 8. 
        { x: 22, y: 40 },
        // 9. 
        { x: 16, y: 32 },
        // 10. 
        { x: 24, y: 24 },
        // 11. 
        { x: 35, y: 16 },
        // 12. 
        { x: 55, y: 10 }
        // 13. Yan'an (pushed back slightly to avoid overlap)
      ]
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
    },
    currentCheckpointIndex() {
      const ratio = this.todaysSteps / this.stepTarget;
      const index = Math.floor(ratio * 13) + 1;
      return index > 13 ? 13 : index;
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
    if (this.activeTab === "today") {
      this.$nextTick(() => {
        setTimeout(() => {
          this.drawMap();
        }, 300);
      });
    }
  },
  methods: {
    drawMap() {
      const query = common_vendor.index.createSelectorQuery().in(this);
      query.select("#map-container").boundingClientRect((data) => {
        if (!data)
          return;
        const width = data.width;
        const height = data.height;
        const ctx = common_vendor.index.createCanvasContext("routeCanvas", this);
        ctx.clearRect(0, 0, width, height);
        const points = this.checkpoints.map((cp) => ({
          x: cp.x / 100 * width,
          y: cp.y / 100 * height
        }));
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          let isCurve = false;
          let isSingleZig = false;
          let cx = 0, cy = 0;
          if (i === 0) {
            isCurve = true;
            cx = (p1.x + p2.x) / 2;
            cy = Math.max(p1.y, p2.y) + 40;
          } else if (i === 1) {
            isCurve = true;
            cx = (p1.x + p2.x) / 2;
            cy = Math.max(p1.y, p2.y) + 12;
          } else if (i === 3) {
            isCurve = true;
            cx = (p1.x + p2.x) / 2 + 35;
            cy = Math.max(p1.y, p2.y) + 60;
          } else if (i === 11) {
            isSingleZig = true;
            cx = (p1.x + p2.x) / 2 - 5;
            cy = Math.min(p1.y, p2.y) - 25;
          }
          const startRadius = i === 0 ? 14 : 8;
          const endRadius = i + 1 === points.length - 1 ? 18 : 10;
          let startX, startY, endX, endY, endAngle;
          if (isCurve || isSingleZig) {
            const angStart = Math.atan2(cy - p1.y, cx - p1.x);
            startX = p1.x + startRadius * Math.cos(angStart);
            startY = p1.y + startRadius * Math.sin(angStart);
            const angEnd = Math.atan2(p2.y - cy, p2.x - cx);
            endX = p2.x - endRadius * Math.cos(angEnd);
            endY = p2.y - endRadius * Math.sin(angEnd);
            endAngle = angEnd;
          } else {
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            startX = p1.x + startRadius * Math.cos(angle);
            startY = p1.y + startRadius * Math.sin(angle);
            endX = p2.x - endRadius * Math.cos(angle);
            endY = p2.y - endRadius * Math.sin(angle);
            endAngle = angle;
          }
          const lineEndX = endX - 10 * Math.cos(endAngle);
          const lineEndY = endY - 10 * Math.sin(endAngle);
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          if (isCurve) {
            ctx.quadraticCurveTo(cx, cy, lineEndX, lineEndY);
          } else if (isSingleZig) {
            ctx.lineTo(cx, cy);
            ctx.lineTo(lineEndX, lineEndY);
          } else {
            ctx.lineTo(lineEndX, lineEndY);
          }
          ctx.setStrokeStyle("#f5d76e");
          ctx.setLineWidth(5);
          ctx.stroke();
          if (i === 11) {
            const imgSize = 24;
            ctx.drawImage("/static/checkpoint.png", endX - imgSize / 2, endY - imgSize / 2, imgSize, imgSize);
          } else {
            const arrowLength = 14;
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(
              endX - arrowLength * Math.cos(endAngle - Math.PI / 6),
              endY - arrowLength * Math.sin(endAngle - Math.PI / 6)
            );
            ctx.lineTo(
              endX - arrowLength * Math.cos(endAngle + Math.PI / 6),
              endY - arrowLength * Math.sin(endAngle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fillStyle = "#f5d76e";
            ctx.fill();
          }
        }
        ctx.draw();
      }).exec();
    },
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
      } else if (tab === "today") {
        this.$nextTick(() => {
          setTimeout(() => {
            this.drawMap();
          }, 300);
        });
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
          common_vendor.index.__f__("error", "at pages/index/index.vue:354", "Leaderboard fetch failed:", err);
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
              common_vendor.index.__f__("error", "at pages/index/index.vue:410", err);
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
            common_vendor.index.__f__("error", "at pages/index/index.vue:436", "Avatar download failed:", err);
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
          common_vendor.index.__f__("error", "at pages/index/index.vue:461", "Avatar upload failed:", err);
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
            common_vendor.index.__f__("error", "at pages/index/index.vue:484", "syncSteps failed:", res.result);
          }
        },
        fail: (err) => {
          common_vendor.index.hideLoading();
          common_vendor.index.showToast({ title: "同步失败，请重试", icon: "none" });
          common_vendor.index.__f__("error", "at pages/index/index.vue:490", "callFunction fail:", err);
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
    h: common_vendor.t($options.daysLeft),
    i: common_vendor.f($data.checkpoints, (cp, index, i0) => {
      return common_vendor.e({
        a: index === 0 || index === $data.checkpoints.length - 1
      }, index === 0 || index === $data.checkpoints.length - 1 ? {} : {}, {
        b: index,
        c: common_vendor.n(index === 0 || index === $data.checkpoints.length - 1 ? "checkpoint-star" : "checkpoint-dot"),
        d: cp.x + "%",
        e: cp.y + "%"
      });
    })
  } : {}, {
    j: $data.activeTab === "period"
  }, $data.activeTab === "period" ? common_vendor.e({
    k: $data.leaderboardLoading
  }, $data.leaderboardLoading ? {} : common_vendor.e({
    l: common_vendor.f($data.leaderboard, (item, index, i0) => {
      return {
        a: common_vendor.t(index + 1),
        b: index < 3 ? 1 : "",
        c: item.avatarUrl || "/static/default-avatar.png",
        d: common_vendor.t(item.nickname || "微信用户"),
        e: common_vendor.t(item.todaySteps.toLocaleString()),
        f: item._openid
      };
    }),
    m: $data.leaderboard.length === 0
  }, $data.leaderboard.length === 0 ? {} : {})) : {}, {
    n: $data.activeTab === "today"
  }, $data.activeTab === "today" ? {} : {}, {
    o: common_vendor.o(($event) => $options.switchTab("today")),
    p: $data.activeTab === "period"
  }, $data.activeTab === "period" ? {} : {}, {
    q: common_vendor.o(($event) => $options.switchTab("period")),
    r: $data.showProfileModal
  }, $data.showProfileModal ? {
    s: $data.tempAvatarUrl || "/static/default-avatar.png",
    t: common_vendor.o((...args) => $options.onChooseAvatar && $options.onChooseAvatar(...args)),
    v: $data.tempNickname,
    w: common_vendor.o((...args) => $options.onNicknameBlur && $options.onNicknameBlur(...args)),
    x: common_vendor.o((...args) => $options.onNicknameChange && $options.onNicknameChange(...args)),
    y: common_vendor.o((...args) => $options.confirmProfile && $options.confirmProfile(...args)),
    z: common_vendor.o((...args) => $options.cancelProfile && $options.cancelProfile(...args))
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/index/index.js.map

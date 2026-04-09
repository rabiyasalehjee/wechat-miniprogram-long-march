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
      drawnSteps: 0,
      mapWidth: 0,
      mapHeight: 0,
      // Map check points (1 to 13 based on the Long March route)
      checkpoints: [
        { x: 85, y: 80, label: "瑞金", pos: "right", style: "margin-left: 36rpx;" },
        // 1. Extra gap
        { x: 65, y: 84, label: "血战湘江", pos: "bottom", style: "margin-top: 24rpx;" },
        // 2. Extra gap from downward curve
        { x: 50, y: 73, label: "遵义会议", pos: "right" },
        // 3. 
        { x: 36, y: 68, label: "四波赤水", pos: "top" },
        // 4. 
        { x: 25, y: 75, label: "巧渡金沙江", pos: "left" },
        // 5. 
        { x: 15, y: 65, label: "强渡大渡河", pos: "right" },
        // 6. 
        { x: 22, y: 56, label: "飞夺泸定桥", pos: "right" },
        // 7. 
        { x: 15, y: 48, label: "爬雪山", pos: "left" },
        // 8. 
        { x: 22, y: 40, label: "懋功会师", pos: "right" },
        // 9. 
        { x: 16, y: 32, label: "过草地", pos: "left" },
        // 10. 
        { x: 24, y: 24, label: "激战腊子口", pos: "right" },
        // 11. 
        { x: 35, y: 16, label: "大会师", pos: "top", style: "margin-bottom: 24rpx;" },
        // 12. Extra gap from upward curve
        { x: 55, y: 10 }
        // 13. Yan'an
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
      if (this.stepTarget <= 0)
        return 0;
      const ratio = Math.min(1, this.drawnSteps / this.stepTarget);
      const index = Math.floor(ratio * 12) + 1;
      return index > 13 ? 13 : index;
    },
    completedSegments() {
      if (this.stepTarget <= 0)
        return 0;
      const stepsPerSegment = this.stepTarget / 12;
      return Math.min(12, Math.floor(this.drawnSteps / stepsPerSegment));
    },
    currentSegmentProgress() {
      if (this.stepTarget <= 0)
        return 0;
      if (this.drawnSteps >= this.stepTarget)
        return 1;
      const stepsPerSegment = this.stepTarget / 12;
      return this.drawnSteps % stepsPerSegment / stepsPerSegment;
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
          this.initMapAndAnimate(0, this.todaysSteps);
        }, 300);
      });
    }
  },
  methods: {
    initMapAndAnimate(startSteps, targetSteps) {
      if (this.mapWidth && this.mapHeight) {
        this.animateMapProgress(startSteps, targetSteps);
        return;
      }
      const query = common_vendor.index.createSelectorQuery().in(this);
      query.select("#map-container").boundingClientRect((data) => {
        if (data) {
          this.mapWidth = data.width;
          this.mapHeight = data.height;
        }
        this.animateMapProgress(startSteps, targetSteps);
      }).exec();
    },
    animateMapProgress(startValue, endValue) {
      const duration = 2e3;
      const startTime = Date.now();
      const step = () => {
        if (this.activeTab !== "today")
          return;
        const now = Date.now();
        const progress = Math.min((now - startTime) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        this.drawnSteps = Math.floor(startValue + (endValue - startValue) * easeProgress);
        this.drawMap();
        if (progress < 1) {
          setTimeout(step, 16);
        }
      };
      step();
    },
    drawMap() {
      if (!this.mapWidth || !this.mapHeight)
        return;
      const width = this.mapWidth;
      const height = this.mapHeight;
      const ctx = common_vendor.index.createCanvasContext("routeCanvas", this);
      ctx.clearRect(0, 0, width, height);
      const points = this.checkpoints.map((cp) => ({
        x: cp.x / 100 * width,
        y: cp.y / 100 * height
      }));
      this.drawPathSegments(ctx, points, width, height, false);
      this.drawPathSegments(ctx, points, width, height, true);
      ctx.draw();
    },
    drawPathSegments(ctx, points, width, height, isActivePass) {
      for (let i = 0; i < points.length - 1; i++) {
        if (isActivePass && i > this.completedSegments)
          continue;
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
        const overlapOffset = isActivePass ? 10 : 12.1;
        const lineEndX = endX - overlapOffset * Math.cos(endAngle);
        const lineEndY = endY - overlapOffset * Math.sin(endAngle);
        const isFullyActive = isActivePass && i < this.completedSegments;
        const isPartiallyActive = isActivePass && i === this.completedSegments;
        const progress = isPartiallyActive ? this.currentSegmentProgress : 1;
        if (isActivePass && progress <= 0)
          continue;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        if (progress >= 1) {
          if (isCurve) {
            ctx.quadraticCurveTo(cx, cy, lineEndX, lineEndY);
          } else if (isSingleZig) {
            ctx.lineTo(cx, cy);
            ctx.lineTo(lineEndX, lineEndY);
          } else {
            ctx.lineTo(lineEndX, lineEndY);
          }
        } else {
          const curveRes = 50;
          const maxStep = Math.ceil(curveRes * progress);
          for (let step = 1; step <= maxStep; step++) {
            const t = Math.min(step / curveRes, progress);
            let currentX, currentY;
            if (isCurve) {
              currentX = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * cx + Math.pow(t, 2) * lineEndX;
              currentY = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * cy + Math.pow(t, 2) * lineEndY;
            } else if (isSingleZig) {
              if (t < 0.5) {
                const nt = t * 2;
                currentX = startX + (cx - startX) * nt;
                currentY = startY + (cy - startY) * nt;
              } else {
                const nt = (t - 0.5) * 2;
                currentX = cx + (lineEndX - cx) * nt;
                currentY = cy + (lineEndY - cy) * nt;
              }
            } else {
              currentX = startX + (lineEndX - startX) * t;
              currentY = startY + (lineEndY - startY) * t;
            }
            ctx.lineTo(currentX, currentY);
          }
        }
        ctx.setStrokeStyle(isActivePass ? "#f5d76e" : "rgba(255, 255, 255, 0.2)");
        ctx.setLineWidth(5);
        ctx.stroke();
        if (!isActivePass || isFullyActive) {
          if (i === 11) {
            if (isActivePass || !this.isActivePass) {
              const shouldDrawIcon = isActivePass && isFullyActive || !isActivePass && !isFullyActive;
              if (shouldDrawIcon) {
                const imgSize = 24;
                if (!isActivePass)
                  ctx.setGlobalAlpha(0.3);
                ctx.drawImage("/static/checkpoint.png", endX - imgSize / 2, endY - imgSize / 2, imgSize, imgSize);
                if (!isActivePass)
                  ctx.setGlobalAlpha(1);
              }
            }
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
            ctx.fillStyle = isActivePass ? "#f5d76e" : "rgba(255, 255, 255, 0.2)";
            ctx.fill();
          }
        }
      }
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
            this.drawnSteps = this.todaysSteps;
            this.initMapAndAnimate(this.todaysSteps, this.todaysSteps);
          }, 100);
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
          common_vendor.index.__f__("error", "at pages/index/index.vue:475", "Leaderboard fetch failed:", err);
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
      this.$nextTick(() => {
        setTimeout(() => this.drawMap(), 300);
      });
      this.uploadAvatarAndSync(this.tempAvatarUrl, name);
    },
    cancelProfile() {
      this.showProfileModal = false;
      this.$nextTick(() => {
        setTimeout(() => this.drawMap(), 300);
      });
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
              common_vendor.index.__f__("error", "at pages/index/index.vue:542", err);
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
            common_vendor.index.__f__("error", "at pages/index/index.vue:568", "Avatar download failed:", err);
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
          common_vendor.index.__f__("error", "at pages/index/index.vue:593", "Avatar upload failed:", err);
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
            const oldSteps = that.todaysSteps;
            that.todaysSteps = res.result.todaySteps;
            that.saveData();
            common_vendor.index.showToast({ title: "步数已更新！", icon: "success" });
            if (that.activeTab === "today") {
              that.initMapAndAnimate(oldSteps, that.todaysSteps);
            }
          } else {
            common_vendor.index.showToast({ title: res.result.msg || "出错了，请重试", icon: "none" });
            common_vendor.index.__f__("error", "at pages/index/index.vue:622", "syncSteps failed:", res.result);
          }
        },
        fail: (err) => {
          common_vendor.index.hideLoading();
          common_vendor.index.showToast({ title: "同步失败，请重试", icon: "none" });
          common_vendor.index.__f__("error", "at pages/index/index.vue:628", "callFunction fail:", err);
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
  }, $data.activeTab === "today" ? common_vendor.e({
    g: common_assets._imports_1,
    h: common_vendor.t($options.daysLeft),
    i: !$data.showProfileModal
  }, !$data.showProfileModal ? {} : {}, {
    j: !$data.showProfileModal
  }, !$data.showProfileModal ? {
    k: common_vendor.f($data.checkpoints, (cp, index, i0) => {
      return common_vendor.e({
        a: index === 0 || index === $data.checkpoints.length - 1
      }, index === 0 || index === $data.checkpoints.length - 1 ? {} : {}, {
        b: index,
        c: common_vendor.n(index === 0 || index === $data.checkpoints.length - 1 ? "checkpoint-star" : "checkpoint-dot"),
        d: common_vendor.n(index < $options.currentCheckpointIndex ? "checkpoint-active" : "checkpoint-inactive"),
        e: common_vendor.n(index < $options.currentCheckpointIndex && $data.drawnSteps > 0 || index === 0 && $data.drawnSteps === 0 ? "checkpoint-blinking" : ""),
        f: cp.x + "%",
        g: cp.y + "%"
      });
    })
  } : {}, {
    l: !$data.showProfileModal
  }, !$data.showProfileModal ? {
    m: common_vendor.f($data.checkpoints, (cp, index, i0) => {
      return common_vendor.e({
        a: index === $data.checkpoints.length - 1
      }, index === $data.checkpoints.length - 1 ? {} : {}, {
        b: cp.label
      }, cp.label ? {
        c: common_vendor.t(cp.label),
        d: common_vendor.n("label-" + cp.pos),
        e: common_vendor.s(cp.style)
      } : {}, {
        f: "label-" + index,
        g: cp.x + "%",
        h: cp.y + "%"
      });
    })
  } : {}) : {}, {
    n: $data.activeTab === "period"
  }, $data.activeTab === "period" ? common_vendor.e({
    o: $data.leaderboardLoading
  }, $data.leaderboardLoading ? {} : common_vendor.e({
    p: common_vendor.f($data.leaderboard, (item, index, i0) => {
      return {
        a: common_vendor.t(index + 1),
        b: index < 3 ? 1 : "",
        c: item.avatarUrl || "/static/default-avatar.png",
        d: common_vendor.t(item.nickname || "微信用户"),
        e: common_vendor.t(item.todaySteps.toLocaleString()),
        f: item._openid
      };
    }),
    q: $data.leaderboard.length === 0
  }, $data.leaderboard.length === 0 ? {} : {})) : {}, {
    r: $data.activeTab === "today"
  }, $data.activeTab === "today" ? {} : {}, {
    s: common_vendor.o(($event) => $options.switchTab("today")),
    t: $data.activeTab === "period"
  }, $data.activeTab === "period" ? {} : {}, {
    v: common_vendor.o(($event) => $options.switchTab("period")),
    w: $data.showProfileModal
  }, $data.showProfileModal ? {
    x: $data.tempAvatarUrl || "/static/default-avatar.png",
    y: common_vendor.o((...args) => $options.onChooseAvatar && $options.onChooseAvatar(...args)),
    z: $data.tempNickname,
    A: common_vendor.o((...args) => $options.onNicknameBlur && $options.onNicknameBlur(...args)),
    B: common_vendor.o((...args) => $options.onNicknameChange && $options.onNicknameChange(...args)),
    C: common_vendor.o((...args) => $options.confirmProfile && $options.confirmProfile(...args)),
    D: common_vendor.o((...args) => $options.cancelProfile && $options.cancelProfile(...args))
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/index/index.js.map

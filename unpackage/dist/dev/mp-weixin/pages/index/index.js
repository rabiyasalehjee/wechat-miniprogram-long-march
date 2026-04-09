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
      userPosition: null,
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
        { x: 88, y: 79, label: "瑞金", pos: "right", style: "margin-left: 36rpx;" },
        // 1. Extra gap
        { x: 68, y: 84, label: "血战湘江", pos: "bottom", style: "" },
        // 2.
        { x: 53, y: 73, label: "遵义会议", pos: "right" },
        // 3.
        { x: 39, y: 68, label: "四波赤水", pos: "top" },
        // 4.
        { x: 28, y: 75, label: "巧渡金沙江", pos: "left" },
        // 5.
        { x: 18, y: 65, label: "强渡大渡河", pos: "left" },
        // 6. shifted right for label spacing
        { x: 25, y: 56, label: "飞夺泸定桥", pos: "right" },
        // 7.
        { x: 18, y: 48, label: "爬雪山", pos: "left" },
        // 8.
        { x: 25, y: 40, label: "懋功会师", pos: "left" },
        // 9.
        { x: 19, y: 32, label: "过草地", pos: "left" },
        // 10.
        { x: 27, y: 24, label: "激战腊子口", pos: "left" },
        // 11.
        { x: 38, y: 16, label: "大会师", pos: "right" },
        // 12.
        { x: 58, y: 10 }
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
    },
    userMarkerTextPos() {
      if (!this.userPosition)
        return "top";
      const ux = this.userPosition.x;
      const uy = this.userPosition.y;
      let nearest = null;
      let minDist = Infinity;
      for (const cp of this.checkpoints) {
        if (!cp.label)
          continue;
        const dist = Math.sqrt(Math.pow(cp.x - ux, 2) + Math.pow(cp.y - uy, 2));
        if (dist < minDist) {
          minDist = dist;
          nearest = cp;
        }
      }
      if (!nearest || minDist > 12)
        return "top";
      const opposite = { left: "right", right: "left", top: "bottom", bottom: "top", "bottom-left": "right" };
      return opposite[nearest.pos] || "top";
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
        } else {
          this.computeUserPosition();
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
    computeUserPosition() {
      if (!this.mapWidth || !this.mapHeight || this.drawnSteps <= 0) {
        this.userPosition = null;
        return;
      }
      const W = this.mapWidth;
      const H = this.mapHeight;
      const points = this.checkpoints.map((cp) => ({
        x: cp.x / 100 * W,
        y: cp.y / 100 * H
      }));
      const segIdx = this.completedSegments;
      const t = this.currentSegmentProgress;
      if (segIdx >= points.length - 1) {
        const last = points[points.length - 1];
        this.userPosition = { x: last.x / W * 100, y: last.y / H * 100 };
        return;
      }
      const p1 = points[segIdx];
      const p2 = points[segIdx + 1];
      let x, y;
      if (segIdx === 0) {
        const cx = (p1.x + p2.x) / 2, cy = Math.max(p1.y, p2.y) + 20;
        x = Math.pow(1 - t, 2) * p1.x + 2 * (1 - t) * t * cx + t * t * p2.x;
        y = Math.pow(1 - t, 2) * p1.y + 2 * (1 - t) * t * cy + t * t * p2.y;
      } else if (segIdx === 1) {
        const cx = (p1.x + p2.x) / 2, cy = Math.max(p1.y, p2.y) + 12;
        x = Math.pow(1 - t, 2) * p1.x + 2 * (1 - t) * t * cx + t * t * p2.x;
        y = Math.pow(1 - t, 2) * p1.y + 2 * (1 - t) * t * cy + t * t * p2.y;
      } else if (segIdx === 3) {
        const cx = (p1.x + p2.x) / 2 + 35, cy = Math.max(p1.y, p2.y) + 60;
        x = Math.pow(1 - t, 2) * p1.x + 2 * (1 - t) * t * cx + t * t * p2.x;
        y = Math.pow(1 - t, 2) * p1.y + 2 * (1 - t) * t * cy + t * t * p2.y;
      } else if (segIdx === 11) {
        const cx = p1.x, cy = p1.y - 35, cx2 = p2.x - 30, cy2 = p2.y;
        const u = 1 - t;
        x = u * u * u * p1.x + 3 * u * u * t * cx + 3 * u * t * t * cx2 + t * t * t * p2.x;
        y = u * u * u * p1.y + 3 * u * u * t * cy + 3 * u * t * t * cy2 + t * t * t * p2.y;
      } else {
        x = p1.x + (p2.x - p1.x) * t;
        y = p1.y + (p2.y - p1.y) * t;
      }
      this.userPosition = { x: x / W * 100, y: y / H * 100 };
    },
    drawPathSegments(ctx, points, width, height, isActivePass) {
      for (let i = 0; i < points.length - 1; i++) {
        if (isActivePass && i > this.completedSegments)
          continue;
        const p1 = points[i];
        const p2 = points[i + 1];
        let isCurve = false;
        let isSingleZig = false;
        let isCubic = false;
        let cx = 0, cy = 0, cx2 = 0, cy2 = 0;
        if (i === 0) {
          isCurve = true;
          cx = (p1.x + p2.x) / 2;
          cy = Math.max(p1.y, p2.y) + 20;
        } else if (i === 1) {
          isCurve = true;
          cx = (p1.x + p2.x) / 2;
          cy = Math.max(p1.y, p2.y) + 12;
        } else if (i === 3) {
          isCurve = true;
          cx = (p1.x + p2.x) / 2 + 35;
          cy = Math.max(p1.y, p2.y) + 60;
        } else if (i === 11) {
          isCubic = true;
          cx = p1.x;
          cy = p1.y - 35;
          cx2 = p2.x - 30;
          cy2 = p2.y;
        }
        const startRadius = i === 0 ? 14 : 8;
        const endRadius = i + 1 === points.length - 1 ? 18 : 10;
        let startX, startY, endX, endY, endAngle;
        if (isCubic) {
          const angStart = Math.atan2(cy - p1.y, cx - p1.x);
          startX = p1.x + startRadius * Math.cos(angStart);
          startY = p1.y + startRadius * Math.sin(angStart);
          const angEnd = Math.atan2(p2.y - cy2, p2.x - cx2);
          endX = p2.x - endRadius * Math.cos(angEnd);
          endY = p2.y - endRadius * Math.sin(angEnd);
          endAngle = angEnd;
        } else if (isCurve || isSingleZig) {
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
          if (isCubic) {
            ctx.bezierCurveTo(cx, cy, cx2, cy2, lineEndX, lineEndY);
          } else if (isCurve) {
            ctx.quadraticCurveTo(cx, cy, lineEndX, lineEndY);
          } else {
            ctx.lineTo(lineEndX, lineEndY);
          }
        } else {
          const curveRes = 50;
          const maxStep = Math.ceil(curveRes * progress);
          for (let step = 1; step <= maxStep; step++) {
            const t = Math.min(step / curveRes, progress);
            let currentX, currentY;
            if (isCubic) {
              const u = 1 - t;
              currentX = u * u * u * startX + 3 * u * u * t * cx + 3 * u * t * t * cx2 + t * t * t * lineEndX;
              currentY = u * u * u * startY + 3 * u * u * t * cy + 3 * u * t * t * cy2 + t * t * t * lineEndY;
            } else if (isCurve) {
              currentX = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * cx + Math.pow(t, 2) * lineEndX;
              currentY = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * cy + Math.pow(t, 2) * lineEndY;
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
          common_vendor.index.__f__("error", "at pages/index/index.vue:585", "Leaderboard fetch failed:", err);
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
              common_vendor.index.__f__("error", "at pages/index/index.vue:652", err);
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
            common_vendor.index.__f__("error", "at pages/index/index.vue:678", "Avatar download failed:", err);
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
          common_vendor.index.__f__("error", "at pages/index/index.vue:703", "Avatar upload failed:", err);
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
            if (res.result.rank)
              that.todayRank = res.result.rank;
            that.saveData();
            common_vendor.index.showToast({ title: "步数已更新！", icon: "success" });
            if (that.activeTab === "today") {
              that.initMapAndAnimate(oldSteps, that.todaysSteps);
            }
          } else {
            common_vendor.index.showToast({ title: res.result.msg || "出错了，请重试", icon: "none" });
            common_vendor.index.__f__("error", "at pages/index/index.vue:733", "syncSteps failed:", res.result);
          }
        },
        fail: (err) => {
          common_vendor.index.hideLoading();
          common_vendor.index.showToast({ title: "同步失败，请重试", icon: "none" });
          common_vendor.index.__f__("error", "at pages/index/index.vue:739", "callFunction fail:", err);
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
        b: index > 0 && index < $options.currentCheckpointIndex
      }, index > 0 && index < $options.currentCheckpointIndex ? {} : {}, {
        c: index,
        d: common_vendor.n(index === 0 || index === $data.checkpoints.length - 1 ? "checkpoint-star" : "checkpoint-dot"),
        e: common_vendor.n(index < $options.currentCheckpointIndex ? "checkpoint-active" : "checkpoint-inactive"),
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
  } : {}, {
    n: $data.userPosition && !$data.showProfileModal && $data.drawnSteps > 0
  }, $data.userPosition && !$data.showProfileModal && $data.drawnSteps > 0 ? {
    o: common_assets._imports_2,
    p: common_vendor.t($data.todaysSteps.toLocaleString()),
    q: common_vendor.n("user-steps-" + $options.userMarkerTextPos),
    r: $data.userPosition.x + "%",
    s: $data.userPosition.y + "%"
  } : {}) : {}, {
    t: $data.activeTab === "period"
  }, $data.activeTab === "period" ? common_vendor.e({
    v: $data.leaderboardLoading
  }, $data.leaderboardLoading ? {} : common_vendor.e({
    w: common_vendor.f($data.leaderboard, (item, index, i0) => {
      return {
        a: common_vendor.t(index + 1),
        b: index < 3 ? 1 : "",
        c: item.avatarUrl || "/static/default-avatar.png",
        d: common_vendor.t(item.nickname || "微信用户"),
        e: common_vendor.t(item.todaySteps.toLocaleString()),
        f: item._openid
      };
    }),
    x: $data.leaderboard.length === 0
  }, $data.leaderboard.length === 0 ? {} : {})) : {}, {
    y: $data.activeTab === "today"
  }, $data.activeTab === "today" ? {} : {}, {
    z: common_vendor.o(($event) => $options.switchTab("today")),
    A: $data.activeTab === "period"
  }, $data.activeTab === "period" ? {} : {}, {
    B: common_vendor.o(($event) => $options.switchTab("period")),
    C: $data.showProfileModal
  }, $data.showProfileModal ? {
    D: $data.tempAvatarUrl || "/static/default-avatar.png",
    E: common_vendor.o((...args) => $options.onChooseAvatar && $options.onChooseAvatar(...args)),
    F: $data.tempNickname,
    G: common_vendor.o((...args) => $options.onNicknameBlur && $options.onNicknameBlur(...args)),
    H: common_vendor.o((...args) => $options.onNicknameChange && $options.onNicknameChange(...args)),
    I: common_vendor.o((...args) => $options.confirmProfile && $options.confirmProfile(...args)),
    J: common_vendor.o((...args) => $options.cancelProfile && $options.cancelProfile(...args))
  } : {});
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/index/index.js.map

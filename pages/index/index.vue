<template>
  <view class="app">
    <image class="bg-image" src="/static/bg-img.png" mode="aspectFill" />

    <!-- Top Nav Bar -->
    <view class="top-nav">
      <view class="nav-left">
        <view class="nav-row-1">
          <text class="nav-yellow">今日步数：{{ todaysSteps }}</text>
          <text class="nav-yellow nav-gap">今日排名：{{ todayRank }}</text>
        </view>
        <view class="nav-row-2">
          <text class="nav-yellow nav-hint">距离延安还有{{ remainingSteps }}步，继续加油！</text>
        </view>
      </view>
      <button class="sync-btn" @click="syncWeRunData">同步微信步数</button>
    </view>

    <!-- Tab 1: 今日榜单 -->
    <view v-if="activeTab === 'today'" class="tab1-wrapper">
      <view class="title-section">
        <image class="title-image" src="/static/title.png" mode="widthFix" />
        <view class="countdown-badge">
          <text class="countdown-text">距离活动结束还有{{ daysLeft }}天</text>
        </view>
      </view>
      <view class="tab1-content" id="map-container">
        <!-- Route Canvas for Lines (Using v-if to completely remove native component from DOM while modal is open) -->
        <canvas 
          v-if="!showProfileModal"
          canvas-id="routeCanvas" 
          id="routeCanvas" 
          class="route-canvas"
        ></canvas>
        
        <!-- Checkpoint Markers -->
        <view 
          v-if="!showProfileModal"
          v-for="(cp, index) in checkpoints" 
          :key="index"
          class="checkpoint"
          :class="[
            (index === 0 || index === checkpoints.length - 1) ? 'checkpoint-star' : 'checkpoint-dot',
            index < currentCheckpointIndex ? 'checkpoint-active' : 'checkpoint-inactive',
            (index < currentCheckpointIndex && drawnSteps > 0) || (index === 0 && drawnSteps === 0) ? 'checkpoint-blinking' : ''
          ]"
          :style="{ left: cp.x + '%', top: cp.y + '%' }"
        >
          <text class="cp-star" v-if="index === 0 || index === checkpoints.length - 1">★</text>
        </view>
        
        <!-- Checkpoint Labels (Rendered outside the blinking view to prevent blinking) -->
        <view 
          v-if="!showProfileModal"
          v-for="(cp, index) in checkpoints" 
          :key="'label-'+index"
          class="checkpoint-label-container"
          :style="{ left: cp.x + '%', top: cp.y + '%' }"
        >
          <text v-if="index === checkpoints.length - 1" class="final-text">终点150000步</text>
          <text v-if="cp.label" class="cp-label" :class="'label-' + cp.pos" :style="cp.style">{{ cp.label }}</text>
        </view>
      </view>
    </view>

    <!-- Tab 2: 本期榜单 -->
    <view v-if="activeTab === 'period'" class="tab2-wrapper">
      <view v-if="leaderboardLoading" class="loading-wrap">
        <text class="placeholder-text">加载中...</text>
      </view>
      <scroll-view v-else scroll-y class="leaderboard-list">
        <view
          v-for="(item, index) in leaderboard"
          :key="item._openid"
          class="leader-item"
        >
          <text class="rank-num" :class="{ 'rank-top': index < 3 }">{{ index + 1 }}</text>
          <view class="avatar-wrap">
            <image
              class="avatar"
              :src="item.avatarUrl || '/static/default-avatar.png'"
              mode="aspectFill"
            />
          </view>
          <text class="leader-name">{{ item.nickname || '微信用户' }}</text>
          <text class="leader-steps">{{ item.todaySteps.toLocaleString() }} 步</text>
        </view>
        <view v-if="leaderboard.length === 0" class="empty-wrap">
          <text class="placeholder-text">暂无数据</text>
        </view>
      </scroll-view>
    </view>

    <!-- Bottom Nav Bar -->
    <view class="bottom-nav">
      <view class="tab-item" @click="switchTab('today')">
        <text class="tab-text">今日榜单</text>
        <view class="active-line" v-if="activeTab === 'today'"></view>
      </view>
      <view class="tab-divider"></view>
      <view class="tab-item" @click="switchTab('period')">
        <text class="tab-text">本期榜单</text>
        <view class="active-line" v-if="activeTab === 'period'"></view>
      </view>
    </view>

    <!-- Profile Setup Modal -->
    <view v-if="showProfileModal" class="modal-mask">
      <view class="modal-box">
        <text class="modal-title">设置您的资料</text>
        <text class="modal-hint">用于在排行榜中显示您的信息</text>

        <!-- Avatar picker -->
        <button class="avatar-picker-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
          <image
            class="modal-avatar"
            :src="tempAvatarUrl || '/static/default-avatar.png'"
            mode="aspectFill"
          />
          <text class="avatar-picker-label">点击选择头像</text>
        </button>

        <!-- Nickname input (type=nickname auto-fills on real device; also supports manual typing) -->
        <input
          class="nickname-input"
          type="nickname"
          placeholder="输入您的昵称"
          :value="tempNickname"
          @blur="onNicknameBlur"
          @input="onNicknameChange"
        />

        <button class="modal-confirm-btn" @click="confirmProfile">确认并同步步数</button>
        <button class="modal-cancel-btn" @click="cancelProfile">取消</button>
      </view>
    </view>

  </view>
</template>

<script>
export default {
  data() {
    return {
      todaysSteps: 0,
      totalStepsHistory: 0,
      stepTarget: 150000,
      todayRank: '无',
      activeTab: 'today',
      endDate: new Date('2026-05-29T23:59:59'),
      leaderboard: [],
      leaderboardLoading: false,
      userNickname: '',
      userAvatarUrl: '',
      showProfileModal: false,
      tempNickname: '',
      tempAvatarUrl: '',
      pendingSyncCode: '',
      pendingSyncEncryptedData: '',
      pendingSyncIv: '',
      drawnSteps: 0,
      mapWidth: 0,
      mapHeight: 0,
      // Map check points (1 to 13 based on the Long March route)
      checkpoints: [
        { x: 85, y: 80, label: '瑞金', pos: 'right', style: 'margin-left: 36rpx;' }, // 1. Extra gap
        { x: 65, y: 84, label: '血战湘江', pos: 'bottom', style: 'margin-top: 24rpx;' }, // 2. Extra gap from downward curve
        { x: 50, y: 73, label: '遵义会议', pos: 'right' }, // 3. 
        { x: 36, y: 68, label: '四波赤水', pos: 'top' }, // 4. 
        { x: 25, y: 75, label: '巧渡金沙江', pos: 'left' }, // 5. 
        { x: 15, y: 65, label: '强渡大渡河', pos: 'right' }, // 6. 
        { x: 22, y: 56, label: '飞夺泸定桥', pos: 'right' }, // 7. 
        { x: 15, y: 48, label: '爬雪山', pos: 'left' }, // 8. 
        { x: 22, y: 40, label: '懋功会师', pos: 'right' }, // 9. 
        { x: 16, y: 32, label: '过草地', pos: 'left' }, // 10. 
        { x: 24, y: 24, label: '激战腊子口', pos: 'right' }, // 11. 
        { x: 35, y: 16, label: '大会师', pos: 'top', style: 'margin-bottom: 24rpx;' }, // 12. Extra gap from upward curve
        { x: 55, y: 10 }  // 13. Yan'an
      ]
    }
  },
  computed: {
    remainingSteps() {
      const rem = this.stepTarget - this.todaysSteps;
      return (rem > 0 ? rem : 0).toLocaleString();
    },
    daysLeft() {
      const now = new Date();
      const diff = this.endDate - now;
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days > 0 ? days : 0;
    },
    currentCheckpointIndex() {
      // 13 points = 12 segments.
      if (this.stepTarget <= 0) return 0;
      const ratio = Math.min(1, this.drawnSteps / this.stepTarget);
      const index = Math.floor(ratio * 12) + 1; // 12 segments
      return index > 13 ? 13 : index;
    },
    completedSegments() {
      if (this.stepTarget <= 0) return 0;
      const stepsPerSegment = this.stepTarget / 12;
      return Math.min(12, Math.floor(this.drawnSteps / stepsPerSegment));
    },
    currentSegmentProgress() {
      if (this.stepTarget <= 0) return 0;
      if (this.drawnSteps >= this.stepTarget) return 1;
      const stepsPerSegment = this.stepTarget / 12;
      return (this.drawnSteps % stepsPerSegment) / stepsPerSegment;
    }
  },
  mounted() {
    this.loadLocalData();
    const cached = uni.getStorageSync('userProfile');
    if (cached && cached.nickname) {
      this.userNickname = cached.nickname;
      const av = cached.avatarUrl || '';
      this.userAvatarUrl = av.startsWith('cloud://') ? av : '';
    }
    
    // Draw the map path if starting on today tab
    if (this.activeTab === 'today') {
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
      const query = uni.createSelectorQuery().in(this);
      query.select('#map-container').boundingClientRect(data => {
        if (data) {
          this.mapWidth = data.width;
          this.mapHeight = data.height;
        }
        this.animateMapProgress(startSteps, targetSteps);
      }).exec();
    },
    animateMapProgress(startValue, endValue) {
      const duration = 2000; // 2 seconds animation
      const startTime = Date.now();
      
      const step = () => {
        if (this.activeTab !== 'today') return; // Stop if user switched tabs
        
        const now = Date.now();
        const progress = Math.min((now - startTime) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
        
        this.drawnSteps = Math.floor(startValue + (endValue - startValue) * easeProgress);
        this.drawMap();
        
        if (progress < 1) {
          setTimeout(step, 16); // ~60fps
        }
      };
      step();
    },
    drawMap() {
      if (!this.mapWidth || !this.mapHeight) return;
      const width = this.mapWidth;
      const height = this.mapHeight;
      
      const ctx = uni.createCanvasContext('routeCanvas', this);
      ctx.clearRect(0, 0, width, height);

        // Convert percentage coordinates to pixels
        const points = this.checkpoints.map(cp => ({
          x: (cp.x / 100) * width,
          y: (cp.y / 100) * height
        }));

      // First pass: Draw all inactive (grey) paths underneath
      this.drawPathSegments(ctx, points, width, height, false);
      // Second pass: Draw active (yellow) paths on top
      this.drawPathSegments(ctx, points, width, height, true);
      
      ctx.draw();
    },
    drawPathSegments(ctx, points, width, height, isActivePass) {
      for (let i = 0; i < points.length - 1; i++) {
        // If we are doing the active pass and haven't reached this segment at all, skip
        if (isActivePass && i > this.completedSegments) continue;
        // If we are doing the inactive pass and this segment is fully completed, we don't strictly need to draw it, 
        // but it's fine to draw underneath. Let's just draw all inactive, then overdraw active.

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

        const startRadius = (i === 0) ? 14 : 8; 
        const endRadius = (i + 1 === points.length - 1) ? 18 : 10; 
        
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

        // To prevent transparent grey lines from overlapping with the grey arrowhead and creating a darker artifact,
        // we stop the line exactly at the flat base of the arrowhead (14 * cos(30deg) ≈ 12.1px).
        // For the solid active yellow line, a slight overlap (10px) is fine and prevents micro-gaps.
        const overlapOffset = isActivePass ? 10 : 12.1;
        const lineEndX = endX - overlapOffset * Math.cos(endAngle);
        const lineEndY = endY - overlapOffset * Math.sin(endAngle);

        const isFullyActive = isActivePass && i < this.completedSegments;
        const isPartiallyActive = isActivePass && i === this.completedSegments;
        const progress = isPartiallyActive ? this.currentSegmentProgress : 1.0;

        // Skip drawing an empty active segment
        if (isActivePass && progress <= 0) continue;

        ctx.beginPath();
        ctx.moveTo(startX, startY);

        if (progress >= 1.0) {
          // Draw full segment
          if (isCurve) {
            ctx.quadraticCurveTo(cx, cy, lineEndX, lineEndY);
          } else if (isSingleZig) {
            ctx.lineTo(cx, cy); 
            ctx.lineTo(lineEndX, lineEndY);
          } else {
            ctx.lineTo(lineEndX, lineEndY);
          }
        } else {
          // Draw partial segment smoothly using exact progress
          const curveRes = 50; // High resolution for smooth curves
          const maxStep = Math.ceil(curveRes * progress);
          
          for (let step = 1; step <= maxStep; step++) {
            // Ensure the final step lands exactly on the continuous progress value
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

        ctx.setStrokeStyle(isActivePass ? '#f5d76e' : 'rgba(255, 255, 255, 0.2)');
        ctx.setLineWidth(5);
        ctx.stroke();

        // Only draw arrowheads if the segment is fully active (or for the inactive background)
        if (!isActivePass || isFullyActive) {
          if (i === 11) {
            if (isActivePass || !this.isActivePass) {
               // Only draw icon once, on the active pass if active, or inactive pass if not reached
               const shouldDrawIcon = (isActivePass && isFullyActive) || (!isActivePass && !isFullyActive);
               if (shouldDrawIcon) {
                 const imgSize = 24;
                 // Set global alpha for greyed out image if inactive
                 if (!isActivePass) ctx.setGlobalAlpha(0.3);
                 ctx.drawImage('/static/checkpoint.png', endX - imgSize/2, endY - imgSize/2, imgSize, imgSize);
                 if (!isActivePass) ctx.setGlobalAlpha(1.0);
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
            ctx.fillStyle = isActivePass ? '#f5d76e' : 'rgba(255, 255, 255, 0.2)';
            ctx.fill();
          }
        }
      }
    },
    loadLocalData() {
      const savedSteps = uni.getStorageSync('totalStepsHistory');
      if (savedSteps) {
        this.totalStepsHistory = parseInt(savedSteps, 10);
      }
      const savedToday = uni.getStorageSync('todaysSteps');
      if (savedToday) {
        this.todaysSteps = parseInt(savedToday, 10);
      }
    },
    saveData() {
      uni.setStorageSync('totalStepsHistory', this.totalStepsHistory);
      uni.setStorageSync('todaysSteps', this.todaysSteps);
    },
    switchTab(tab) {
      this.activeTab = tab;
      if (tab === 'period') {
        this.fetchLeaderboard();
      } else if (tab === 'today') {
        this.$nextTick(() => {
          setTimeout(() => {
            this.drawnSteps = this.todaysSteps; // Snap directly on tab switch
            this.initMapAndAnimate(this.todaysSteps, this.todaysSteps);
          }, 100);
        });
      }
    },
    fetchLeaderboard() {
      this.leaderboardLoading = true;
      wx.cloud.callFunction({
        name: 'getSteps',
        data: { action: 'getLeaderboard' },
        success: (res) => {
          // Temp URLs are now resolved server-side in the cloud function,
          // so we can use the list directly without a client-side getTempFileURL call.
          this.leaderboard = res.result.list || [];
          this.leaderboardLoading = false;
        },
        fail: (err) => {
          console.error('Leaderboard fetch failed:', err);
          this.leaderboardLoading = false;
        }
      });
    },
    onChooseAvatar(e) {
      this.tempAvatarUrl = e.detail.avatarUrl;
    },
    onNicknameBlur(e) {
      if (e.detail.value) this.tempNickname = e.detail.value;
    },
    onNicknameChange(e) {
      this.tempNickname = e.detail.value;
    },
    confirmProfile() {
      const name = this.tempNickname.trim();
      if (!name) {
        uni.showToast({ title: '请填写昵称', icon: 'none' });
        return;
      }
      this.userNickname = name;
      this.showProfileModal = false;
      
      // Redraw map after modal closes (since v-if destroyed the canvas)
      this.$nextTick(() => {
        setTimeout(() => this.drawMap(), 300);
      });
      
      this.uploadAvatarAndSync(this.tempAvatarUrl, name);
    },
    cancelProfile() {
      this.showProfileModal = false;
      
      // Redraw map after modal closes
      this.$nextTick(() => {
        setTimeout(() => this.drawMap(), 300);
      });
    },
    syncWeRunData() {
      uni.showLoading({ title: '准备中...' });
      if (this.userNickname) {
        this.startWeRunSync(this.userNickname, this.userAvatarUrl);
      } else {
        this.startWeRunSync('', '');
      }
    },
    startWeRunSync(nickname, avatarUrl) {
      const that = this;
      uni.login({
        provider: 'weixin',
        success: (loginRes) => {
          const code = loginRes.code;
          uni.getWeRunData({
            success(res) {
              if (!that.userNickname) {
                uni.hideLoading();
                that.pendingSyncCode = code;
                that.pendingSyncEncryptedData = res.encryptedData;
                that.pendingSyncIv = res.iv;
                that.showProfileModal = true;
              } else {
                that.sendToServer(code, res.encryptedData, res.iv, nickname, avatarUrl);
              }
            },
            fail(err) {
              uni.hideLoading();
              uni.showToast({ title: '读取数据失败', icon: 'none' });
              console.error(err);
            }
          });
        },
        fail() {
          uni.hideLoading();
          uni.showToast({ title: '登录失败', icon: 'none' });
        }
      });
    },
    uploadAvatarAndSync(localPath, nickname) {
      const that = this;
      if (!localPath) {
        that.doSync(nickname, '');
        return;
      }
      // chooseAvatar returns an https:// CDN URL, not a local path.
      // wx.cloud.uploadFile requires a local file path, so we must download it first.
      if (localPath.startsWith('http')) {
        uni.showLoading({ title: '上传头像...' });
        uni.downloadFile({
          url: localPath,
          success: (dlRes) => {
            that._uploadLocalFileAndSync(dlRes.tempFilePath, nickname);
          },
          fail: (err) => {
            console.error('Avatar download failed:', err);
            uni.hideLoading();
            that.doSync(nickname, '');
          }
        });
      } else {
        uni.showLoading({ title: '上传头像...' });
        that._uploadLocalFileAndSync(localPath, nickname);
      }
    },
    _uploadLocalFileAndSync(localPath, nickname) {
      const that = this;
      const ext = localPath.split('.').pop().split('?')[0] || 'jpg';
      const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      wx.cloud.uploadFile({
        cloudPath,
        filePath: localPath,
        success: (uploadRes) => {
          const cloudUrl = uploadRes.fileID;
          that.userAvatarUrl = cloudUrl;
          uni.setStorageSync('userProfile', { nickname, avatarUrl: cloudUrl });
          uni.hideLoading();
          that.doSync(nickname, cloudUrl);
        },
        fail: (err) => {
          console.error('Avatar upload failed:', err);
          uni.hideLoading();
          that.doSync(nickname, '');
        }
      });
    },
    doSync(nickname, avatarUrl) {
      this.sendToServer(this.pendingSyncCode, this.pendingSyncEncryptedData, this.pendingSyncIv, nickname, avatarUrl);
    },
    sendToServer(code, encryptedData, iv, nickname, avatarUrl) {
      const that = this;
      uni.showLoading({ title: '读取中...' });
      wx.cloud.callFunction({
        name: 'getSteps',
        data: { action: 'syncSteps', code, encryptedData, iv, nickname, avatarUrl },
        success: (res) => {
          uni.hideLoading();
          if (res.result && res.result.success) {
            const oldSteps = that.todaysSteps;
            that.todaysSteps = res.result.todaySteps;
            that.saveData();
            uni.showToast({ title: '步数已更新！', icon: 'success' });
            
            // Animate growth from old to new steps
            if (that.activeTab === 'today') {
              that.initMapAndAnimate(oldSteps, that.todaysSteps);
            }
          } else {
            uni.showToast({ title: res.result.msg || '出错了，请重试', icon: 'none' });
            console.error('syncSteps failed:', res.result);
          }
        },
        fail: (err) => {
          uni.hideLoading();
          uni.showToast({ title: '同步失败，请重试', icon: 'none' });
          console.error('callFunction fail:', err);
        }
      });
    }
  }
}
</script>

<style>
page {
  height: 100%;
  overflow: hidden;
}

.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.bg-image {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.top-nav,
.tab1-wrapper,
.tab2-wrapper,
.bottom-nav {
  position: relative;
  z-index: 1;
}

/* ── Top Nav ── */
.top-nav {
  background-color: rgba(30, 70, 45, 0.85);
  padding: 20rpx 32rpx;
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.nav-left {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  margin-right: 24rpx;
}

.nav-row-1 {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 10rpx;
}

.nav-row-2 {
  display: flex;
  flex-direction: row;
  align-items: center;
}

.nav-yellow {
  font-size: 26rpx;
  color: #f5d76e;
  font-weight: 500;
}

.nav-gap {
  margin-left: 40rpx;
}

.nav-hint {
  font-size: 24rpx;
  color: #f5d76e;
}

.sync-btn {
  background-color: #ffffff;
  color: #2d6040;
  font-size: 24rpx;
  font-weight: 600;
  border-radius: 40rpx;
  border: 2rpx solid #4a9e6a;
  padding: 0 28rpx;
  height: 78rpx;
  line-height: 78rpx;
  min-width: 0;
  flex-shrink: 0;
  align-self: center;
}
.sync-btn::after {
  border: none;
}

/* ── Tab 1 ── */
.tab1-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.title-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 32rpx 8rpx;
}

.title-image {
  width: 85%; /* Reduced to give more space for map */
}

.countdown-badge {
  margin-top: 10rpx;
  background-color: #f5d76e;
  border-radius: 100rpx;
  padding: 6rpx 24rpx;
}

.countdown-text {
  font-size: 22rpx; /* Reduced by ~5px equivalent to prevent overlap */
  color: #2d6040;
  font-weight: 600;
}

.tab1-content {
  flex: 1;
  display: flex;
  position: relative;
  width: 100%;
}

.route-canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

.checkpoint {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  z-index: 2;
  transition: all 0.5s ease;
}

.checkpoint-dot.checkpoint-active {
  width: 14rpx;
  height: 14rpx;
  background-color: #660000; /* Active dark red */
  border-radius: 50%;
  box-shadow: 0 0 8rpx rgba(102, 0, 0, 0.5);
}

.checkpoint-dot.checkpoint-inactive {
  width: 14rpx;
  height: 14rpx;
  background-color: rgba(255, 255, 255, 0.4); /* Inactive grey */
  border-radius: 50%;
}

.checkpoint-star {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.checkpoint-star.checkpoint-active .cp-star {
  color: #660000; /* Active dark red */
  text-shadow: 0 0 10rpx rgba(102, 0, 0, 0.6);
}

.checkpoint-star.checkpoint-inactive .cp-star {
  color: rgba(255, 255, 255, 0.5); /* Inactive grey */
}

.cp-star {
  font-size: 40rpx;
  transition: color 0.5s ease;
}

.checkpoint-label-container {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(-50%, -50%);
  z-index: 3;
  pointer-events: none; /* Let touches pass through to points if needed */
}

.cp-label {
  position: absolute;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 500;
  white-space: nowrap;
  text-shadow: 0 2rpx 4rpx rgba(0,0,0,0.8);
}

/* Reduced margins to look tighter but still clear arrows/points */
.label-right {
  left: 100%;
  margin-left: 18rpx;
  top: 50%;
  transform: translateY(-50%);
}

.label-left {
  right: 100%;
  margin-right: 18rpx;
  top: 50%;
  transform: translateY(-50%);
}

.label-top {
  bottom: 100%;
  margin-bottom: 18rpx;
  left: 50%;
  transform: translateX(-50%);
}

.label-bottom {
  top: 100%;
  margin-top: 18rpx;
  left: 50%;
  transform: translateX(-50%);
}

.final-text {
  position: absolute;
  left: 100%;
  margin-left: 18rpx;
  top: 50%;
  transform: translateY(-50%);
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;
  text-shadow: 0 2rpx 6rpx rgba(0,0,0,0.6);
}

/* Blinking Animation for active points */
@keyframes softPulse {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

.checkpoint-blinking {
  animation: softPulse 1.5s infinite ease-in-out;
}

/* ── Tab 2 ── */
.tab2-wrapper {
  flex: 1;
  background-color: #2d6040;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.loading-wrap,
.empty-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.leaderboard-list {
  flex: 1;
  height: 100%;
  padding: 16rpx 0;
}

.leader-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 20rpx 32rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.08);
}

.rank-num {
  width: 48rpx;
  font-size: 28rpx;
  color: rgba(255,255,255,0.5);
  font-weight: 700;
  text-align: center;
  flex-shrink: 0;
}

.rank-top {
  color: #f5d76e;
}

.avatar-wrap {
  width: 80rpx;
  height: 80rpx;
  border-radius: 12rpx;
  overflow: hidden;
  margin: 0 20rpx;
  flex-shrink: 0;
  background-color: rgba(255,255,255,0.1);
}

.avatar {
  width: 80rpx;
  height: 80rpx;
}

.leader-name {
  flex: 1;
  font-size: 28rpx;
  color: #ffffff;
  font-weight: 500;
}

.leader-steps {
  font-size: 28rpx;
  color: #f5d76e;
  font-weight: 700;
  flex-shrink: 0;
}

.placeholder-text {
  font-size: 32rpx;
  color: rgba(255, 255, 255, 0.4);
}

/* ── Bottom Nav ── */
.bottom-nav {
  background-color: rgba(30, 70, 45, 0.85);
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 100rpx;
  padding-bottom: calc(env(safe-area-inset-bottom) / 2);
  flex-shrink: 0;
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  position: relative;
}

.tab-text {
  font-size: 30rpx;
  color: #ffffff;
  font-weight: 500;
}

.tab-divider {
  width: 2rpx;
  height: 44rpx;
  background-color: rgba(255, 255, 255, 0.3);
}

.active-line {
  position: absolute;
  bottom: 14rpx;
  width: 40rpx;
  height: 6rpx;
  background-color: #ffffff;
  border-radius: 3rpx;
}

/* ── Profile Modal ── */
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.6);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-box {
  background-color: #ffffff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
  width: 600rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.modal-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #2d6040;
  margin-bottom: 12rpx;
}

.modal-hint {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 40rpx;
}

.avatar-picker-btn {
  background: none;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0;
  margin-bottom: 32rpx;
}
.avatar-picker-btn::after {
  border: none;
}

.modal-avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 60rpx;
  background-color: #e0e0e0;
  margin-bottom: 12rpx;
}

.avatar-picker-label {
  font-size: 24rpx;
  color: #2d6040;
}

.nickname-input {
  width: 100%;
  height: 80rpx;
  border: 2rpx solid #d0d0d0;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #333;
  margin-bottom: 32rpx;
  box-sizing: border-box;
}

.modal-confirm-btn {
  width: 100%;
  height: 88rpx;
  background-color: #2d6040;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  border-radius: 44rpx;
  line-height: 88rpx;
  margin-bottom: 16rpx;
}
.modal-confirm-btn::after {
  border: none;
}

.modal-cancel-btn {
  width: 100%;
  height: 80rpx;
  background: none;
  color: #888;
  font-size: 26rpx;
  line-height: 80rpx;
}
.modal-cancel-btn::after {
  border: none;
}
</style>

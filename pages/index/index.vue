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
      <view class="tab1-content">
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
      pendingSyncIv: ''
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
    }
  },
  mounted() {
    this.loadLocalData();
    const cached = uni.getStorageSync('userProfile');
    if (cached && cached.nickname) {
      this.userNickname = cached.nickname;
      // Only restore avatar if it's a valid cloud:// URL — wxfile:// paths are
      // device-local temp files that expire and must never be sent to the database.
      const av = cached.avatarUrl || '';
      this.userAvatarUrl = av.startsWith('cloud://') ? av : '';
    }
  },
  methods: {
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
      this.uploadAvatarAndSync(this.tempAvatarUrl, name);
    },
    cancelProfile() {
      this.showProfileModal = false;
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
            that.todaysSteps = res.result.todaySteps;
            that.saveData();
            uni.showToast({ title: '步数已更新！', icon: 'success' });
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
  padding: 24rpx 32rpx 16rpx;
}

.title-image {
  width: 100%;
}

.countdown-badge {
  margin-top: 16rpx;
  background-color: #f5d76e;
  border-radius: 100rpx;
  padding: 10rpx 36rpx;
}

.countdown-text {
  font-size: 26rpx;
  color: #2d6040;
  font-weight: 600;
}

.tab1-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
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

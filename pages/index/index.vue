<template>
  <view class="app">
    <image v-if="activeTab !== 'teams' && activeTab !== 'profile'" class="bg-image" src="/static/bg-img.png" mode="aspectFill" />
    <view v-if="activeTab === 'profile'" class="profile-header-bar">
      <text class="profile-header-title">个人中心</text>
    </view>

    <!-- Top Nav Bar (hidden on teams tab) -->
    <view v-if="activeTab !== 'teams' && activeTab !== 'profile'" class="top-nav">
      <view class="nav-left">
        <view class="nav-row-1 nav-row-hidden">
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
    <view v-show="activeTab === 'today'" class="tab1-wrapper">
      <view class="map-image-section">
        <image class="map-image" src="/static/map-img.jpg" mode="aspectFill" />
        <canvas
          v-if="!showProfileModal"
          canvas-id="redRouteOverlayCanvas"
          id="redRouteOverlayCanvas"
          class="red-route-overlay-canvas"
        ></canvas>
        <view v-if="mapLoading" class="map-loading-overlay">
          <view class="map-loading-spinner"></view>
          <text class="map-loading-text">地图加载中...</text>
        </view>
      </view>

      <!-- this section was the main section display route code that has been set to display none -->
      <view class="main-route-code-hidden">
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
              index < currentCheckpointIndex ? 'checkpoint-active' : 'checkpoint-inactive'
            ]"
            :style="{ left: cp.x + '%', top: cp.y + '%' }"
          >
            <text class="cp-star" v-if="index === 0 || index === checkpoints.length - 1">★</text>
            <view v-if="index > 0 && index < currentCheckpointIndex" class="pulse-ring"></view>
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

          <!-- User progress marker: ONE checkpoint icon at the tip of the yellow line -->
          <view
            v-if="userPosition && !showProfileModal && drawnSteps > 0"
            class="user-marker"
            :style="{ left: userPosition.x + '%', top: userPosition.y + '%' }"
          >
            <image src="/static/checkpoint.png" class="user-marker-img" mode="aspectFit" />
            <text class="user-marker-steps" :class="'user-steps-' + userMarkerTextPos">{{ todaysSteps.toLocaleString() }}</text>
          </view>
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
              :src="item.avatarUrl || '/static/user.png'"
              mode="aspectFill"
              @error="item.avatarUrl = '/static/user.png'"
            />
          </view>
          <view class="leader-info">
            <text class="leader-name">{{ item.nickname || '微信用户' }}</text>
            <text v-if="leaderboardTeamName(item)" class="leader-team">{{ leaderboardTeamName(item) }}</text>
          </view>
          <text class="leader-steps">{{ item.todaySteps.toLocaleString() }} 步</text>
        </view>
        <view v-if="leaderboard.length === 0" class="empty-wrap">
          <text class="placeholder-text">暂无数据</text>
        </view>
      </scroll-view>
    </view>

    <!-- Tab 3: 团队 -->
    <view v-if="activeTab === 'teams'" class="tab3-wrapper">

      <!-- Team Selector (top nav style) -->
      <view class="team-selector-bar">
        <view class="team-selector-item" @click="selectViewTeam('Team1')">
          <text class="team-selector-text" :style="{ color: selectedViewTeam === 'Team1' ? '#ffffff' : 'rgba(255,255,255,0.5)' }">红25军</text>
          <view class="active-line" v-if="selectedViewTeam === 'Team1'"></view>
        </view>
        <view class="tab-divider"></view>
        <view class="team-selector-item" @click="selectViewTeam('Team2')">
          <text class="team-selector-text" :style="{ color: selectedViewTeam === 'Team2' ? '#ffffff' : 'rgba(255,255,255,0.5)' }">红二方面军</text>
          <view class="active-line" v-if="selectedViewTeam === 'Team2'"></view>
        </view>
        <view class="tab-divider"></view>
        <view class="team-selector-item" @click="selectViewTeam('Team3')">
          <text class="team-selector-text" :style="{ color: selectedViewTeam === 'Team3' ? '#ffffff' : 'rgba(255,255,255,0.5)' }">红四方面军</text>
          <view class="active-line" v-if="selectedViewTeam === 'Team3'"></view>
        </view>
        <view class="tab-divider"></view>
        <view class="team-selector-item" @click="selectViewTeam('Team4')">
          <text class="team-selector-text" :style="{ color: selectedViewTeam === 'Team4' ? '#ffffff' : 'rgba(255,255,255,0.5)' }">红一方面军</text>
          <view class="active-line" v-if="selectedViewTeam === 'Team4'"></view>
        </view>
      </view>

      <!-- Team Content -->
      <view class="team-content">

        <!-- Team Header Banner -->
        <view class="team-header-banner">
          <view class="team-header-info">
            <text class="team-header-name">{{ teamChineseName[selectedViewTeam] || selectedViewTeam }}</text>
            <text class="team-header-sub">活动周期：2026.05.04 — 2026.10.22</text>
          </view>
          <view class="team-header-actions">
            <view class="team-header-stat">
              <text class="team-total-km">{{ teamTotalKm }}</text>
              <text class="team-total-km-unit">公里</text>
              <text class="team-total-km-label">团队总里程</text>
            </view>
          </view>
        </view>

        <!-- Loading -->
        <view v-if="teamLoading" class="team-loading-wrap">
          <text class="team-loading-text">加载中...</text>
        </view>

        <!-- Member List -->
        <scroll-view v-else scroll-y class="team-member-list">
          <view class="team-member-list-header">
            <text class="tm-col-rank">#</text>
            <text class="tm-col-name">成员</text>
            <text class="tm-col-today">今日</text>
            <text class="tm-col-total">累计</text>
          </view>

          <view
            v-for="(m, i) in teamMembersSorted"
            :key="m.studentId"
            class="team-member-row"
          >
            <text class="tm-rank" :class="{ 'tm-rank-gold': i === 0, 'tm-rank-silver': i === 1, 'tm-rank-bronze': i === 2 }">{{ i + 1 }}</text>
            <view class="tm-avatar-wrap">
              <image
                class="tm-avatar"
                :src="m.avatarUrl || '/static/user.png'"
                mode="aspectFill"
                @error="m.avatarUrl = '/static/user.png'"
              />
            </view>
            <view class="tm-info">
              <text class="tm-name">{{ m.nickname }}</text>
              <text class="tm-id">{{ m.studentId }}</text>
            </view>
            <view class="tm-today-wrap">
              <text class="tm-today">{{ m.todayKm }}</text>
              <text class="tm-unit">公里</text>
            </view>
            <view class="tm-cumulative-wrap">
              <text class="tm-cumulative">{{ m.cumulativeKm }}</text>
              <text class="tm-unit">公里</text>
            </view>
          </view>

          <view v-if="!teamLoading && teamMembers.length === 0" class="team-empty">
            <text class="team-empty-text">暂无成员数据</text>
            <text class="team-empty-hint">请先在主页同步微信步数</text>
          </view>

          <view v-if="teamMembers.length > 0" class="team-total-row">
            <text class="team-total-label">团队总计</text>
            <text class="team-total-value">{{ teamTotalKm }} 公里</text>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- Stats Panel (today tab only) -->
    <view v-if="activeTab === 'today'" class="stats-panel">
      <view class="stats-row">
        <view class="stats-cell">
          <text class="stats-label">今日步数</text>
          <text class="stats-value">{{ todaysSteps.toLocaleString() }}</text>
        </view>
        <view class="stats-cell">
          <text class="stats-label">今日里程</text>
          <text class="stats-value">{{ todayKm }} <text class="stats-unit">公里</text></text>
        </view>
        <view class="stats-cell">
          <text class="stats-label">今日排名</text>
          <text class="stats-value stats-rank">{{ todayRank === '无' ? '暂无排名' : '第 ' + todayRank + ' 名' }}</text>
        </view>
      </view>
      <view class="stats-row">
        <view class="stats-cell">
          <text class="stats-label">兑换比例</text>
          <text class="stats-value stats-small">1步 = 0.7米</text>
        </view>
        <view class="stats-cell">
          <text class="stats-label">累计里程</text>
          <text class="stats-value">{{ totalKm }} <text class="stats-unit">公里</text></text>
        </view>
        <view class="stats-cell">
          <text class="stats-label">累计天数</text>
          <text class="stats-value">{{ syncDays }} <text class="stats-unit">天</text></text>
        </view>
      </view>
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
      <view class="tab-divider"></view>
      <view class="tab-item" @click="switchTab('teams')">
        <text class="tab-text">团队</text>
        <view class="active-line" v-if="activeTab === 'teams'"></view>
      </view>
      <view class="tab-divider"></view>
      <view class="tab-item" @click="openPersonalCenter">
        <text class="tab-text">个人中心</text>
        <view class="active-line" v-if="activeTab === 'profile'"></view>
      </view>
    </view>

    <!-- Team ID Dialog -->
    <view v-if="showTeamDialog" class="modal-mask">
      <view class="team-dialog-box">
        <view class="team-dialog-header">
          <image class="team-dialog-icon-img" src="/static/running.png" mode="aspectFit" />
          <text class="team-dialog-title">加入团队</text>
          <text class="team-dialog-subtitle">请输入您的学工号以加入团队</text>
        </view>
        <view class="team-input-wrap">
          <input
            class="team-input"
            type="text"
            placeholder="请输入学工号"
            placeholder-class="team-input-placeholder"
            :value="teamIdInput"
            @input="onTeamIdInput"
            @confirm="submitTeamId"
          />
        </view>
        <view v-if="teamErrorMsg" class="team-error-msg">
          <text class="team-error-text">{{ teamErrorMsg }}</text>
        </view>
        <button class="team-enter-btn" @click="submitTeamId">确认加入</button>
        <button class="team-cancel-btn" @click="cancelTeamDialog">暂不加入</button>
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
            :src="tempAvatarUrl || '/static/user.png'"
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

    <!-- Personal Center -->
    <view v-if="activeTab === 'profile'" class="profile-wrapper">
      <view class="profile-shell">
        <view class="profile-identity" @click="!personalEditMode && startPersonalEdit()">
          <button
            v-if="personalEditMode"
            class="profile-avatar-btn"
            open-type="chooseAvatar"
            @chooseavatar="onChooseAvatar"
          >
            <image class="profile-avatar" :src="tempAvatarUrl || userAvatarUrl || '/static/user.png'" mode="aspectFill" />
          </button>
          <view v-else class="profile-avatar-view">
            <image class="profile-avatar" :src="personalDisplayAvatar" mode="aspectFill" />
          </view>

          <view class="profile-name-line" @click.stop="startPersonalEdit">
            <text v-if="!personalEditMode" class="profile-name">{{ personalDisplayName }}</text>
            <input
              v-else
              class="profile-name-input-inline"
              type="text"
              placeholder="输入新的昵称"
              :value="tempNickname"
              @input="onNicknameChange"
              @focus="profileNameEditing = true"
            />
            <text class="profile-arrow">›</text>
          </view>
        </view>

        <view v-if="personalEditMode" class="profile-edit-area">
          <button class="profile-done-btn" @click="savePersonalProfile">done</button>
        </view>
      </view>
    </view>

    <!-- Privacy Authorization Modal -->
    <view v-if="showPrivacyModal" class="modal-mask">
      <view class="privacy-box">
        <text class="privacy-title">用户隐私保护提示</text>
        <text class="privacy-body">在使用本功能前，请阅读并同意我们的隐私保护指引。我们将收集以下信息用于提供服务：</text>
        <view class="privacy-list">
          <text class="privacy-item">· 微信昵称和头像，用于在排行榜中显示</text>
          <text class="privacy-item">· 微信运动步数，用于记录运动情况</text>
        </view>
        <view class="privacy-btns">
          <button class="privacy-btn-cancel" @click="onPrivacyReject">拒绝</button>
          <button class="privacy-btn-agree" id="agreePrivacyBtn" open-type="agreePrivacyAuthorization" @agreeprivacyauthorization="onPrivacyAgree">同意</button>
        </view>
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
      userPosition: null,
      activeTab: 'today',
      endDate: new Date('2026-10-22T23:59:59'),
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
      syncDays: 0,
      // Teams
      showPrivacyModal: false,
      privacyResolve: null,
      showTeamDialog: false,
      personalEditMode: false,
      previousTab: 'today',
      teamIdInput: '',
      teamErrorMsg: '',
      myTeam: '',
      myStudentId: '',
      selectedViewTeam: 'Team1',
      teamMembers: [],
      teamTotalKm: 0,
      teamLoading: false,
      teamRouteTotals: { Team1: 0, Team2: 0, Team3: 0, Team4: 0 },
      teamRouteProgress: { Team1: 0, Team2: 0, Team3: 0, Team4: 0 },
      teamRouteTargets: { Team1: 5000, Team2: 10000, Team3: 5000, Team4: 12500 },
      mapLoading: true,
      mapRenderReady: { route: false, overlay: false },
      mapLoadingTimer: null,
      mapHasLoadedOnce: false,
      teamChineseName: {
        'Team1': '红25军', 'Team2': '红二方面军', 'Team3': '红四方面军', 'Team4': '红一方面军'
      },
      teamColors: {
        'Team1': { primary: '#45A8FF', light: 'rgba(69,168,255,0.15)', name: '红25军' },
        'Team2': { primary: '#F5D327', light: 'rgba(245,211,39,0.15)', name: '红二方面军' },
        'Team3': { primary: '#57DE00', light: 'rgba(87,222,0,0.15)', name: '红四方面军' },
        'Team4': { primary: '#FF2500', light: 'rgba(255,37,0,0.15)', name: '红一方面军' }
      },
      teamData: {
        'Team1': ['21B908040','23B308006','23B908051','24B908021','25B308027','21B908014','22B908026','23B908033','25B908031','25B308018','22B908036'],
        'Team2': ['20B908016','20B908054','21B908043','22B908022','23B308002','23B908038','23B908056','24B308009','24B908037','24B908045','25B308017','20B908061','22B308004','24B908040','25B308008','24B308016','22B908019','18B908028','18B908088','19B908065','21B908039'],
        'Team3': ['18B908105','20B908060','22B908035','22B908040','23B908031','24B908032','24B908041','23B908035','23B908061','25B308023','22B908037','20240093'],
        'Team4': ['19B908045','20B908059','20B908029','21B908038','21B908042','22B308007','22B908023','22B908044','23B908024','24B308008','26B308020','19B908063','19B908064','20B908022','22B908038','23B908022','24B908031','25B908046','26B308012','25B308022','25B908030','18B908014','19B908036','19B908046','20B908017','17B908042'],
      },
      // Map check points (1 to 13 based on the Long March route)
      checkpoints: [
        { x: 88, y: 79, label: '瑞金', pos: 'right', style: 'margin-left: 36rpx;' }, // 1. Extra gap
        { x: 68, y: 84, label: '血战湘江', pos: 'bottom', style: '' }, // 2.
        { x: 53, y: 73, label: '遵义会议', pos: 'right' }, // 3.
        { x: 39, y: 68, label: '四波赤水', pos: 'top' }, // 4.
        { x: 28, y: 75, label: '巧渡金沙江', pos: 'left' }, // 5.
        { x: 18, y: 65, label: '强渡大渡河', pos: 'left' }, // 6. shifted right for label spacing
        { x: 25, y: 56, label: '飞夺泸定桥', pos: 'right' }, // 7.
        { x: 18, y: 48, label: '爬雪山', pos: 'left' }, // 8.
        { x: 25, y: 40, label: '懋功会师', pos: 'left' }, // 9.
        { x: 19, y: 32, label: '过草地', pos: 'left' }, // 10.
        { x: 27, y: 24, label: '激战腊子口', pos: 'left' }, // 11.
        { x: 38, y: 16, label: '大会师', pos: 'right' }, // 12.
        { x: 58, y: 10 }  // 13. Yan'an
      ]
    }
  },
  computed: {
    remainingSteps() {
      const M = 46428571;
      const totalTeamKm = Object.keys(this.teamRouteTotals)
        .reduce((sum, team) => sum + (Number(this.teamRouteTotals[team]) || 0), 0);
      const H = totalTeamKm * 1000 / 0.7;
      const X = M - H;
      return (X > 0 ? Math.floor(X) : 0).toLocaleString();
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
    },
    todayKm() {
      return (this.todaysSteps * 0.0007).toFixed(2);
    },
    totalKm() {
      return (this.totalStepsHistory * 0.0007).toFixed(2);
    },
    teamMembersSorted() {
      return [...this.teamMembers].sort((a, b) => b.cumulativeKm - a.cumulativeKm);
    },
    userMarkerTextPos() {
      if (!this.userPosition) return 'top';
      const ux = this.userPosition.x;
      const uy = this.userPosition.y;
      let nearest = null;
      let minDist = Infinity;
      for (const cp of this.checkpoints) {
        if (!cp.label) continue;
        const dist = Math.sqrt(Math.pow(cp.x - ux, 2) + Math.pow(cp.y - uy, 2));
        if (dist < minDist) { minDist = dist; nearest = cp; }
      }
      if (!nearest || minDist > 12) return 'top';
      const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top', 'bottom-left': 'right' };
      return opposite[nearest.pos] || 'top';
    },
    personalDisplayAvatar() {
      const cached = uni.getStorageSync('userProfile') || {};
      return this.userAvatarUrl || cached.avatarUrl || '/static/user.png';
    },
    personalDisplayName() {
      const cached = uni.getStorageSync('userProfile') || {};
      return this.userNickname || cached.nickname || '微信用户';
    }
  },
  mounted() {
    // Listen for privacy auth requests from App.vue
    uni.$on('needPrivacyAuth', (resolve) => {
      this.privacyResolve = resolve;
      this.showPrivacyModal = true;
    });
    this.loadLocalData();
    // Load team assignment
    const savedTeam = uni.getStorageSync('myTeam');
    const savedId = uni.getStorageSync('myStudentId');
    const validTeams = ['Team1', 'Team2', 'Team3', 'Team4'];
    if (savedTeam && validTeams.includes(savedTeam)) {
      this.myTeam = savedTeam;
      this.myStudentId = savedId;
      this.selectedViewTeam = savedTeam;
    } else if (savedTeam) {
      // Clear stale/invalid team from local storage
      uni.removeStorageSync('myTeam');
      uni.removeStorageSync('myStudentId');
    }
    const cached = uni.getStorageSync('userProfile');
    if (cached && cached.nickname) {
      this.userNickname = cached.nickname;
      const av = cached.avatarUrl || '';
      this.userAvatarUrl = av.startsWith('cloud://') ? av : '';
    }
    
    // Draw the map path if starting on today tab
    if (this.activeTab === 'today') {
      this.resetMapLoading();
      this.$nextTick(() => {
        setTimeout(() => {
          this.fetchAllTeamRouteTotals(false);
          this.initMapAndAnimate(0, this.todaysSteps);
        }, 300);
      });
    }
  },
  beforeDestroy() {
    if (this.mapLoadingTimer) {
      clearTimeout(this.mapLoadingTimer);
      this.mapLoadingTimer = null;
    }
  },
  methods: {
    resetMapLoading() {
      if (this.mapLoadingTimer) {
        clearTimeout(this.mapLoadingTimer);
        this.mapLoadingTimer = null;
      }
      this.mapLoading = true;
      this.mapRenderReady = { route: false, overlay: false };
      this.mapLoadingTimer = setTimeout(() => {
        if (this.mapLoading) {
          this.mapLoading = false;
        }
      }, 6000);
    },
    markMapPieceReady(piece) {
      if (!piece) return;
      this.mapRenderReady[piece] = true;
      if (this.mapRenderReady.route && this.mapRenderReady.overlay) {
        this.mapLoading = false;
        this.mapHasLoadedOnce = true;
        if (this.mapLoadingTimer) {
          clearTimeout(this.mapLoadingTimer);
          this.mapLoadingTimer = null;
        }
      }
    },
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
        this.drawMap(progress >= 1 ? () => this.markMapPieceReady('route') : null);

        if (progress < 1) {
          setTimeout(step, 16); // ~60fps
        } else {
          // Animation done — place the checkpoint marker at the final position
          this.computeUserPosition();
        }
      };
      step();
    },
    drawMap(done = null) {
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
      
      ctx.draw(false, () => {
        if (done) done();
      });
    },
    computeUserPosition() {
      if (!this.mapWidth || !this.mapHeight || this.drawnSteps <= 0) {
        this.userPosition = null;
        return;
      }
      const W = this.mapWidth;
      const H = this.mapHeight;
      const points = this.checkpoints.map(cp => ({
        x: (cp.x / 100) * W,
        y: (cp.y / 100) * H
      }));

      const segIdx = this.completedSegments;
      const t = this.currentSegmentProgress;

      if (segIdx >= points.length - 1) {
        const last = points[points.length - 1];
        this.userPosition = { x: (last.x / W) * 100, y: (last.y / H) * 100 };
        return;
      }

      const p1 = points[segIdx];
      const p2 = points[segIdx + 1];
      let x, y;

      if (segIdx === 0) {
        const cx = (p1.x + p2.x) / 2, cy = Math.max(p1.y, p2.y) + 20;
        x = Math.pow(1-t,2)*p1.x + 2*(1-t)*t*cx + t*t*p2.x;
        y = Math.pow(1-t,2)*p1.y + 2*(1-t)*t*cy + t*t*p2.y;
      } else if (segIdx === 1) {
        const cx = (p1.x + p2.x) / 2, cy = Math.max(p1.y, p2.y) + 12;
        x = Math.pow(1-t,2)*p1.x + 2*(1-t)*t*cx + t*t*p2.x;
        y = Math.pow(1-t,2)*p1.y + 2*(1-t)*t*cy + t*t*p2.y;
      } else if (segIdx === 3) {
        const cx = (p1.x + p2.x) / 2 + 35, cy = Math.max(p1.y, p2.y) + 60;
        x = Math.pow(1-t,2)*p1.x + 2*(1-t)*t*cx + t*t*p2.x;
        y = Math.pow(1-t,2)*p1.y + 2*(1-t)*t*cy + t*t*p2.y;
      } else if (segIdx === 11) {
        const cx = p1.x, cy = p1.y - 35, cx2 = p2.x - 30, cy2 = p2.y;
        const u = 1 - t;
        x = u*u*u*p1.x + 3*u*u*t*cx + 3*u*t*t*cx2 + t*t*t*p2.x;
        y = u*u*u*p1.y + 3*u*u*t*cy + 3*u*t*t*cy2 + t*t*t*p2.y;
      } else {
        x = p1.x + (p2.x - p1.x) * t;
        y = p1.y + (p2.y - p1.y) * t;
      }

      this.userPosition = { x: (x / W) * 100, y: (y / H) * 100 };
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
          cx  = p1.x;       cy  = p1.y - 35;  // go straight up from start
          cx2 = p2.x - 30;  cy2 = p2.y;       // approach destination from the left
        }

        const startRadius = (i === 0) ? 14 : 8; 
        const endRadius = (i + 1 === points.length - 1) ? 18 : 10; 
        
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
          if (isCubic) {
            ctx.bezierCurveTo(cx, cy, cx2, cy2, lineEndX, lineEndY);
          } else if (isCurve) {
            ctx.quadraticCurveTo(cx, cy, lineEndX, lineEndY);
          } else if (isSingleZig) {
            // Rounded corner: stop short of the corner, arc through it, continue to end
            const d1x = cx - startX, d1y = cy - startY;
            const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
            const d2x = lineEndX - cx, d2y = lineEndY - cy;
            const len2 = Math.sqrt(d2x * d2x + d2y * d2y);
            const rr = Math.min(18, len1 * 0.35, len2 * 0.35);
            const bx = cx - (d1x / len1) * rr; // point just before corner
            const by = cy - (d1y / len1) * rr;
            const ax = cx + (d2x / len2) * rr; // point just after corner
            const ay = cy + (d2y / len2) * rr;
            ctx.lineTo(bx, by);
            ctx.quadraticCurveTo(cx, cy, ax, ay);
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
            
            if (isCubic) {
              const u = 1 - t;
              currentX = u*u*u*startX + 3*u*u*t*cx + 3*u*t*t*cx2 + t*t*t*lineEndX;
              currentY = u*u*u*startY + 3*u*u*t*cy + 3*u*t*t*cy2 + t*t*t*lineEndY;
            } else if (isCurve) {
              currentX = Math.pow(1 - t, 2) * startX + 2 * (1 - t) * t * cx + Math.pow(t, 2) * lineEndX;
              currentY = Math.pow(1 - t, 2) * startY + 2 * (1 - t) * t * cy + Math.pow(t, 2) * lineEndY;
            } else if (isSingleZig) {
              // Match the rounded corner path for smooth partial animation
              const d1x = cx - startX, d1y = cy - startY;
              const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
              const d2x = lineEndX - cx, d2y = lineEndY - cy;
              const len2 = Math.sqrt(d2x * d2x + d2y * d2y);
              const rr = Math.min(18, len1 * 0.35, len2 * 0.35);
              const bx = cx - (d1x / len1) * rr;
              const by = cy - (d1y / len1) * rr;
              const ax = cx + (d2x / len2) * rr;
              const ay = cy + (d2y / len2) * rr;
              // Total path has 3 sections: leg1 (start→b), arc (b→a via cx,cy), leg2 (a→end)
              const leg1 = len1 - rr;
              const arcLen = rr * Math.PI * 0.5; // approximate arc length
              const leg2 = len2 - rr;
              const total = leg1 + arcLen + leg2;
              const dist = t * total;
              if (dist <= leg1) {
                const nt = dist / leg1;
                currentX = startX + (bx - startX) * nt;
                currentY = startY + (by - startY) * nt;
              } else if (dist <= leg1 + arcLen) {
                const nt = (dist - leg1) / arcLen;
                currentX = Math.pow(1 - nt, 2) * bx + 2 * (1 - nt) * nt * cx + Math.pow(nt, 2) * ax;
                currentY = Math.pow(1 - nt, 2) * by + 2 * (1 - nt) * nt * cy + Math.pow(nt, 2) * ay;
              } else {
                const nt = (dist - leg1 - arcLen) / leg2;
                currentX = ax + (lineEndX - ax) * nt;
                currentY = ay + (lineEndY - ay) * nt;
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
    },
    loadLocalData() {
      const savedSteps = uni.getStorageSync('totalStepsHistory');
      if (savedSteps !== '' && savedSteps !== null && savedSteps !== undefined) {
        this.totalStepsHistory = parseInt(savedSteps, 10);
      }
      const today = new Date().toDateString();
      const savedDate = uni.getStorageSync('stepsDate');
      if (savedDate === today) {
        const savedToday = uni.getStorageSync('todaysSteps');
        if (savedToday) this.todaysSteps = parseInt(savedToday, 10);
        const savedRank = uni.getStorageSync('todayRank');
        if (savedRank) this.todayRank = savedRank;
      } else {
        // New day — reset daily stats
        this.todaysSteps = 0;
        this.todayRank = '无';
        uni.setStorageSync('todaysSteps', 0);
        uni.setStorageSync('todayRank', '无');
        uni.setStorageSync('stepsDate', today);
      }
      const savedDays = uni.getStorageSync('syncDays');
      if (savedDays) this.syncDays = parseInt(savedDays, 10);
    },
    saveData() {
      uni.setStorageSync('totalStepsHistory', this.totalStepsHistory);
      uni.setStorageSync('todaysSteps', this.todaysSteps);
      uni.setStorageSync('todayRank', this.todayRank);
      uni.setStorageSync('stepsDate', new Date().toDateString());
      uni.setStorageSync('syncDays', this.syncDays);
    },
    switchTab(tab) {
      if (tab === 'profile') {
        this.previousTab = this.activeTab;
        this.activeTab = 'profile';
        this.personalEditMode = false;
        return;
      }
      this.activeTab = tab;
      if (tab === 'teams') {
        if (!this.myTeam) {
          this.teamIdInput = '';
          this.teamErrorMsg = '';
          this.showTeamDialog = true;
        } else {
          this.selectedViewTeam = this.myTeam;
          this.teamMembers = [];
          this.teamTotalKm = 0;
          // Re-link studentId in cloud every time (repairs deleted/missing records)
          wx.cloud.callFunction({ name: 'getSteps', data: { action: 'saveTeamMember', studentId: this.myStudentId } });
          this.fetchTeamData();
        }
        return;
      }
      if (tab === 'period') {
        this.fetchLeaderboard();
      } else if (tab === 'today') {
        this.$nextTick(() => {
          if (this.mapHasLoadedOnce) {
            this.drawnSteps = this.todaysSteps;
            this.computeUserPosition();
            this.drawMap();
            this.fetchAllTeamRouteTotals(false);
            return;
          }
          setTimeout(() => {
            this.fetchAllTeamRouteTotals(true);
            this.drawnSteps = this.todaysSteps; // Snap directly on tab switch
            this.initMapAndAnimate(this.todaysSteps, this.todaysSteps);
          }, 100);
        });
      }
    },
    fetchAllTeamRouteTotals(animated = true) {
      const teams = Object.keys(this.teamData);
      let pending = teams.length;
      const previousProgress = { ...this.teamRouteProgress };
      teams.forEach(teamName => {
        wx.cloud.callFunction({
          name: 'getSteps',
          data: { action: 'getTeamData', teamName },
          success: (res) => {
            if (res.result && res.result.success) {
              this.teamRouteTotals[teamName] = res.result.totalKm || 0;
            }
          },
          complete: () => {
            pending -= 1;
            if (pending === 0) this.updateTeamRouteProgress(animated, previousProgress, () => this.markMapPieceReady('overlay'));
          }
        });
      });
    },
    updateTeamRouteProgress(animated = true, startProgressOverride = null, done = null) {
      const targetProgress = {};
      Object.keys(this.teamData).forEach(team => {
        const totalKm = Number(this.teamRouteTotals[team]) || 0;
        const targetKm = Number(this.teamRouteTargets[team]) || 1;
        targetProgress[team] = Math.min(1, totalKm / targetKm);
      });

      if (!animated) {
        this.teamRouteProgress = { ...targetProgress };
        this.drawTeamRouteOverlay(this.teamRouteProgress, done);
        return;
      }

      const startProgress = startProgressOverride || { ...this.teamRouteProgress };
      const duration = 1600;
      const startTime = Date.now();
      const step = () => {
        const t = Math.min(1, (Date.now() - startTime) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const current = {};
        Object.keys(targetProgress).forEach(team => {
          current[team] = startProgress[team] + (targetProgress[team] - startProgress[team]) * eased;
        });
        this.drawTeamRouteOverlay(current, t < 1 ? null : done);
        if (t < 1) {
          setTimeout(step, 16);
        } else {
          this.teamRouteProgress = { ...targetProgress };
        }
      };
      step();
    },
    drawTeamRouteOverlay(progressByTeam = this.teamRouteProgress, done = null) {
      const query = uni.createSelectorQuery().in(this);
      query.select('.map-image-section').boundingClientRect(rect => {
        if (!rect) return;
        const width = rect.width;
        const height = rect.height;
        const ctx = uni.createCanvasContext('redRouteOverlayCanvas', this);
        const p = (x, y) => ({ x: (x / 100) * width, y: (y / 100) * height });
        const px = (x, y, dx = 0, dy = 0) => ({ x: (x / 100) * width + dx, y: (y / 100) * height + dy });
        const rgba = (hex, alpha) => {
          const raw = hex.replace('#', '');
          const r = parseInt(raw.slice(0, 2), 16);
          const g = parseInt(raw.slice(2, 4), 16);
          const b = parseInt(raw.slice(4, 6), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        const getTeamRoutePoints = team => {
          const routes = {
            Team1: [
              p(43.4, 25.3), p(41.2, 26.0), p(39.2, 26.8), p(37.3, 27.7),
              p(35.3, 28.9), p(33.5, 29.9), p(31.5, 31.0), p(29.4, 32.0),
              p(27.1, 33.1), p(25.4, 33.5), p(24.4, 33.4), p(24.1, 32.9),
              p(24.8, 31.9), p(26.1, 31.0), p(27.7, 30.2), p(29.4, 29.5),
              p(31.4, 28.9), p(29.1, 28.4), p(27.0, 28.1), p(25.1, 28.2),
              p(23.3, 28.6), p(21.7, 29.4), p(20.7, 30.4), p(20.3, 31.5),
              p(20.5, 32.8), p(21.7, 34.1), p(23.4, 35.2), p(25.6, 36.1),
              p(27.9, 36.9), p(29.9, 37.7), p(31.9, 38.6), p(33.7, 39.5),
              p(35.3, 40.6), p(37.0, 41.6), p(38.9, 42.1), p(40.8, 42.3),
              p(43.0, 42.2), p(45.1, 42.1), p(47.1, 42.1), p(49.1, 42.3),
              p(51.2, 42.8), p(52.7, 43.5), p(53.6, 44.5), p(53.9, 45.7),
              p(53.5, 46.9), p(52.4, 48.0), p(50.8, 48.7), p(49.1, 48.9),
              p(47.3, 48.6), p(49.6, 49.4), p(51.9, 49.8), p(54.3, 49.6),
              p(56.6, 48.9), p(58.6, 48.2), p(60.8, 47.7), p(63.0, 47.6),
              p(65.5, 47.8), p(69.0, 48.3), p(72.5, 48.5), p(76.0, 48.7),
              p(79.5, 48.9), p(83.6, 49.5), p(87.3, 50.6), p(90.1, 52.3),
              p(91.9, 54.7)
            ],
            Team2: [
              px(37.5, 77.5, 100), px(43, 72, 100), px(48, 80, 100), px(40, 86, 100),
              px(32, 79, 100), px(39, 70, 100), px(50, 75, 100), p(34, 86), p(25, 92), p(13, 96), p(5, 90),
              p(12, 84), p(24, 88), p(34, 82), p(44, 75), p(39, 80),
              p(31, 78), p(27, 82), p(20, 78), p(12, 84), p(6, 78),
              p(13, 71), p(24, 66), p(12, 62), p(6, 54), p(15, 48),
              p(27, 52), p(20, 58), p(11, 59), p(20, 50), p(35, 53),
              p(46, 45), p(34, 38), p(22, 44), p(13, 38), p(19, 30),
              p(10, 31), p(20, 22), p(36, 25), p(49, 18),
              p(42, 11)
            ],
            Team3: [
              p(57.3, 24.9), p(55.2, 25.8),
              p(52.4, 26.4), p(48.4, 26.8), p(44.5, 26.9), p(41.0, 27.2),
              p(38.1, 27.9), p(36.9, 28.9), p(37.1, 30.0), p(38.4, 30.9),
              p(40.8, 31.6), p(43.1, 31.5), p(44.5, 30.9), p(45.1, 29.9),
              p(45.0, 28.6), p(43.8, 30.4), p(41.8, 32.1), p(38.8, 33.6),
              p(35.0, 34.7), p(30.7, 35.7), p(26.7, 36.6), p(23.2, 37.8),
              p(20.1, 39.1), p(17.6, 40.9), p(15.9, 43.0), p(14.6, 45.2),
              p(13.2, 47.4), p(16.3, 46.8), p(19.7, 46.5), p(23.1, 46.7),
              p(26.5, 47.4), p(29.5, 48.9), p(31.3, 50.7), p(31.6, 52.7),
              p(30.2, 54.7), p(28.3, 56.4), p(27.0, 58.0), p(26.9, 59.6),
              p(28.6, 61.1), p(32.3, 62.2)
            ],
            Team4: [
              p(54.9, 22.8), p(54.0, 21.0), p(52.7, 19.4), p(51.0, 18.4),
              p(49.0, 18.0), p(47.4, 18.2), p(46.4, 18.7), p(45.8, 19.7),
              p(45.7, 21.4), p(45.7, 22.3), p(45.7, 22.7), p(45.7, 22.9),
              p(45.7, 22.9), p(45.6, 23.8), p(45.2, 24.5), p(44.6, 24.9),
              p(43.8, 25.1), p(43.8, 25.1), p(43.5, 25.1), p(42.7, 25.2),
              p(41.2, 25.3), p(39.8, 25.6), p(38.4, 26.2), p(37.1, 27.1),
              p(35.9, 28.4), p(35.8, 28.4), p(35.5, 28.8), p(34.7, 29.7),
              p(33.0, 31.6), p(32.5, 32.4), p(32.3, 33.4), p(32.4, 34.5),
              p(32.5, 35.5), p(32.4, 36.5), p(32.1, 37.3), p(31.5, 37.9),
              p(30.6, 38.4), p(30.5, 38.4), p(30.0, 38.6), p(28.7, 39.2),
              p(26.0, 40.3), p(25.2, 40.7), p(24.8, 41.2), p(24.6, 41.9),
              p(24.4, 42.8), p(24.4, 42.9), p(24.3, 43.5), p(24.2, 45.1),
              p(23.8, 48.1), p(23.5, 49.6), p(23.0, 50.9), p(22.3, 52.0),
              p(21.4, 52.9), p(21.4, 52.9), p(21.3, 53.0), p(21.0, 53.2),
              p(20.5, 53.7), p(20.0, 54.3), p(19.8, 54.9), p(19.8, 55.6),
              p(19.9, 56.3), p(19.9, 56.4), p(20.1, 56.8), p(20.5, 57.9),
              p(21.4, 60.1), p(21.7, 61.3), p(21.6, 62.5), p(21.1, 63.5),
              p(20.4, 64.5), p(20.4, 64.5), p(20.2, 64.7), p(19.7, 65.2),
              p(18.8, 66.1), p(18.0, 67.3), p(17.4, 68.6), p(17.0, 70.0),
              p(16.9, 71.6), p(16.9, 71.8), p(16.9, 72.8), p(16.9, 75.7),
              p(16.9, 81.4), p(16.9, 83.2), p(16.8, 84.7), p(16.5, 86.1),
              p(16.0, 87.2), p(15.9, 87.8), p(15.9, 88.4), p(16.3, 88.8),
              p(16.9, 89.1), p(17.7, 89.6), p(18.2, 90.2), p(18.5, 91.1),
              p(18.6, 92.1), p(18.8, 93.3), p(19.6, 94.1), p(20.9, 94.6),
              p(22.6, 94.9), p(25.2, 94.8), p(27.8, 94.2), p(30.4, 93.2),
              p(32.9, 91.9), p(35.0, 90.4), p(37.1, 88.6), p(38.8, 86.6),
              p(40.3, 84.2), p(41.1, 82.2), p(41.5, 80.2), p(41.5, 78.2),
              p(40.9, 76.3), p(40.1, 75.2), p(38.9, 74.7), p(37.4, 74.7),
              p(35.8, 75.2), p(35.8, 75.2), p(35.4, 75.3), p(34.3, 75.7),
              p(32.2, 76.4), p(32.3, 76.4), p(32.9, 76.5), p(34.7, 76.7),
              p(38.1, 77.2), p(38.2, 77.2), p(38.3, 77.0), p(38.6, 76.6),
              p(39.2, 75.8), p(39.2, 75.8), p(39.4, 76.0), p(39.7, 76.5),
              p(40.3, 77.5), p(40.3, 77.5), p(40.2, 77.7), p(39.9, 78.3),
              p(39.2, 79.4), p(39.3, 79.4), p(39.5, 79.5), p(40.1, 79.9),
              p(41.2, 80.6), p(41.3, 80.6), p(41.5, 80.4), p(42.3, 79.9),
              p(43.6, 78.9), p(43.7, 79.0), p(43.9, 79.1), p(44.6, 79.5),
              p(46.0, 80.2), p(46.0, 80.2), p(46.1, 80.5), p(46.5, 81.3),
              p(47.1, 82.9), p(47.2, 82.9), p(47.5, 82.8), p(48.2, 82.8),
              p(49.7, 82.8), p(49.7, 82.7), p(49.9, 82.5), p(50.5, 81.9),
              p(51.6, 80.7), p(53.3, 79.8), p(55.2, 79.9), p(57.2, 80.8),
              p(59.1, 82.3), p(59.1, 82.4), p(59.5, 82.7), p(60.5, 83.7),
              p(62.6, 85.6), p(65.1, 87.7), p(67.8, 89.4), p(70.5, 90.6),
              p(73.5, 91.4), p(76.9, 91.9), p(80.3, 92.4), p(83.8, 93.2),
              p(87.4, 94.4)
            ]
          };
          if (team === 'Team1') return routes.Team1.slice().reverse().map(pt => ({ x: pt.x + 24, y: pt.y }));
          if (team === 'Team3') return routes.Team3.slice().reverse();
          if (team === 'Team4') return routes.Team4.slice().reverse();
          return routes[team] || routes.Team1;
        };
        const pointAtProgress = (points, progress) => {
          if (progress <= 0) return [];
          if (progress >= 1) return points;
          const lengths = [];
          let total = 0;
          for (let i = 1; i < points.length; i++) {
            const len = Math.sqrt(Math.pow(points[i].x - points[i - 1].x, 2) + Math.pow(points[i].y - points[i - 1].y, 2));
            lengths.push(len);
            total += len;
          }
          let remaining = total * progress;
          const partial = [points[0]];
          for (let i = 1; i < points.length; i++) {
            const len = lengths[i - 1];
            if (remaining >= len) {
              partial.push(points[i]);
              remaining -= len;
            } else {
              const ratio = len === 0 ? 0 : remaining / len;
              partial.push({
                x: points[i - 1].x + (points[i].x - points[i - 1].x) * ratio,
                y: points[i - 1].y + (points[i].y - points[i - 1].y) * ratio
              });
              break;
            }
          }
          return partial;
        };
        const progressAtPoint = (points, pointIndex) => {
          let total = 0;
          let distanceToPoint = 0;
          for (let i = 1; i < points.length; i++) {
            const len = Math.sqrt(Math.pow(points[i].x - points[i - 1].x, 2) + Math.pow(points[i].y - points[i - 1].y, 2));
            total += len;
            if (i <= pointIndex) distanceToPoint += len;
          }
          return total === 0 ? 1 : distanceToPoint / total;
        };
        const drawPath = (points, strokeWidth, color) => {
          if (!points.length) return;
          const trace = (offsetX, offsetY) => {
            ctx.beginPath();
            ctx.moveTo(points[0].x + offsetX, points[0].y + offsetY);
            if (points.length === 2) {
              ctx.lineTo(points[1].x + offsetX, points[1].y + offsetY);
            } else {
              for (let i = 1; i < points.length; i++) {
                if (i === points.length - 1) {
                  ctx.lineTo(points[i].x + offsetX, points[i].y + offsetY);
                  break;
                }
                const prev = points[i - 1];
                const cur = points[i];
                const next = points[i + 1];
                const radius = 5;
                const inLen = Math.sqrt(Math.pow(cur.x - prev.x, 2) + Math.pow(cur.y - prev.y, 2)) || 1;
                const outLen = Math.sqrt(Math.pow(next.x - cur.x, 2) + Math.pow(next.y - cur.y, 2)) || 1;
                const corner = Math.min(radius, inLen * 0.35, outLen * 0.35);
                const before = {
                  x: cur.x - ((cur.x - prev.x) / inLen) * corner,
                  y: cur.y - ((cur.y - prev.y) / inLen) * corner
                };
                const after = {
                  x: cur.x + ((next.x - cur.x) / outLen) * corner,
                  y: cur.y + ((next.y - cur.y) / outLen) * corner
                };
                ctx.lineTo(before.x + offsetX, before.y + offsetY);
                ctx.quadraticCurveTo(cur.x + offsetX, cur.y + offsetY, after.x + offsetX, after.y + offsetY);
              }
            }
            ctx.setStrokeStyle(color);
            ctx.setLineCap('round');
            ctx.setLineJoin('round');
            ctx.stroke();
          };
          if (ctx.setGlobalAlpha) ctx.setGlobalAlpha(0.45);
          ctx.setLineWidth(strokeWidth * 0.65);
          trace(1.2, -0.8);
          if (ctx.setGlobalAlpha) ctx.setGlobalAlpha(1);
          ctx.setLineWidth(strokeWidth);
          trace(0, 0);
        };
        const drawRouteDot = (point, color) => {
          if (!point) return;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
          ctx.setFillStyle(color);
          ctx.fill();
          ctx.setStrokeStyle('rgba(255, 245, 220, 0.7)');
          ctx.setLineWidth(1);
          ctx.stroke();
        };
        const drawTeamCheckpoint = (team, point, alpha) => {
          if (!point) return;
          const teamNumber = team.replace('Team', '');
          const size = this.myTeam === team ? 30 : 24;
          if (ctx.setGlobalAlpha) ctx.setGlobalAlpha(alpha);
          ctx.drawImage(`/static/team${teamNumber}-checkpoint.png`, point.x - size / 2, point.y - size, size, size);
          if (ctx.setGlobalAlpha) ctx.setGlobalAlpha(1);
        };

        ctx.clearRect(0, 0, width, height);
        Object.keys(this.teamData).forEach(team => {
          drawPath(getTeamRoutePoints(team), 2.6, 'rgba(92, 92, 92, 0.45)');
        });
        Object.keys(this.teamData).forEach(team => {
          const routePoints = getTeamRoutePoints(team);
          const teamColor = this.teamColors[team].primary;
          const isMine = this.myTeam === team;
          const alpha = isMine ? 1 : 0.32;
          const teamProgress = progressByTeam[team] || 0;
          const partial = pointAtProgress(routePoints, teamProgress);
          drawPath(partial, isMine ? 3.2 : 2.5, rgba(teamColor, alpha));
          const routeDotIndexes = team === 'Team2' ? [6, 12, 18, 24, 30] : (team === 'Team1' ? [10, 22, 34, 46, 58] : (team === 'Team3' ? [4, 10, 16, 22, 28] : [18, 44, 70, 96, 122]));
          routeDotIndexes.forEach(i => {
            if (!routePoints[i]) return;
            const dotIsFilled = teamProgress >= progressAtPoint(routePoints, i);
            drawRouteDot(routePoints[i], dotIsFilled ? rgba(teamColor, alpha) : 'rgba(92, 92, 92, 0.65)');
          });
          if ((progressByTeam[team] || 0) >= 1) {
            drawTeamCheckpoint(team, routePoints[routePoints.length - 1], alpha);
          }
        });
        ctx.draw(false, () => {
          if (done) done();
        });
      }).exec();
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
    leaderboardTeamName(item) {
      if (!item || !item.studentId) return '';
      const targetId = String(item.studentId).toUpperCase();
      for (const [team, ids] of Object.entries(this.teamData)) {
        if (ids.map(id => id.toUpperCase()).includes(targetId)) {
          return this.teamChineseName[team] || '';
        }
      }
      return '';
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
    openPersonalCenter() {
      const cached = uni.getStorageSync('userProfile') || {};
      this.tempNickname = this.userNickname || cached.nickname || '';
      this.tempAvatarUrl = this.userAvatarUrl || cached.avatarUrl || '';
      this.personalEditMode = false;
      this.previousTab = this.activeTab;
      this.activeTab = 'profile';
    },
    closePersonalCenter() {
      this.personalEditMode = false;
      this.activeTab = this.previousTab || 'today';
    },
    startPersonalEdit() {
      const cached = uni.getStorageSync('userProfile') || {};
      this.tempNickname = this.userNickname || cached.nickname || '';
      this.tempAvatarUrl = this.userAvatarUrl || cached.avatarUrl || '';
      this.personalEditMode = true;
    },
    cancelPersonalEdit() {
      this.personalEditMode = false;
      this.tempNickname = this.userNickname || (uni.getStorageSync('userProfile') || {}).nickname || '';
      this.tempAvatarUrl = this.userAvatarUrl || (uni.getStorageSync('userProfile') || {}).avatarUrl || '';
    },
    applyProfileUpdateToVisibleData(nickname, avatarUrl, previousNickname = '', previousAvatar = '') {
      const safeNickname = String(nickname || '').trim();
      const safeAvatar = String(avatarUrl || '').trim();
      this.userNickname = safeNickname;
      this.userAvatarUrl = safeAvatar;

      const cachedProfile = { nickname: safeNickname, avatarUrl: safeAvatar };
      uni.setStorageSync('userProfile', cachedProfile);

      const studentId = String(this.myStudentId || '').trim().toUpperCase();
      if (studentId) {
        this.teamMembers = (this.teamMembers || []).map((member) => {
          if (String(member.studentId || '').trim().toUpperCase() !== studentId) return member;
          return {
            ...member,
            nickname: safeNickname,
            avatarUrl: safeAvatar
          };
        });

        this.leaderboard = (this.leaderboard || []).map((item) => {
          if (String(item.studentId || '').trim().toUpperCase() !== studentId) return item;
          return {
            ...item,
            nickname: safeNickname,
            avatarUrl: safeAvatar
          };
        });
      } else {
        const prevName = String(previousNickname || '').trim();
        const prevAvatarSafe = String(previousAvatar || '').trim();
        if (prevName || prevAvatarSafe) {
          this.leaderboard = (this.leaderboard || []).map((item) => {
            const itemName = String(item.nickname || '').trim();
            const itemAvatar = String(item.avatarUrl || '').trim();
            if (prevName && itemName === prevName) {
              return {
                ...item,
                nickname: safeNickname,
                avatarUrl: safeAvatar
              };
            }
            if (prevAvatarSafe && itemAvatar === prevAvatarSafe) {
              return {
                ...item,
                nickname: safeNickname,
                avatarUrl: safeAvatar
              };
            }
            return item;
          });
        }
      }
    },
    savePersonalProfile() {
      const name = (this.tempNickname || '').trim();
      if (!name) {
        uni.showToast({ title: '请填写昵称', icon: 'none' });
        return;
      }
      uni.showLoading({ title: '保存中...' });
      const avatar = this.tempAvatarUrl || this.userAvatarUrl || '';
      if (avatar && avatar.startsWith('cloud://')) {
        this._saveProfileToCloud(name, avatar);
        return;
      }
      if (avatar && avatar.startsWith('http')) {
        uni.showLoading({ title: '保存中...' });
        uni.downloadFile({
          url: avatar,
          success: (dlRes) => {
            this._uploadLocalAvatarAndSaveProfile(dlRes.tempFilePath, name);
          },
          fail: () => {
            uni.hideLoading();
            this._saveProfileToCloud(name, this.userAvatarUrl || '');
          }
        });
        return;
      }
      if (avatar) {
        this._uploadLocalAvatarAndSaveProfile(avatar, name);
        return;
      }
      this._saveProfileToCloud(name, avatar);
    },
    _uploadLocalAvatarAndSaveProfile(localPath, nickname) {
      const ext = localPath.split('.').pop().split('?')[0] || 'jpg';
      const cloudPath = `avatars/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      wx.cloud.uploadFile({
        cloudPath,
        filePath: localPath,
        success: (uploadRes) => {
          this._saveProfileToCloud(nickname, uploadRes.fileID);
        },
        fail: (err) => {
          console.error('Profile avatar upload failed:', err);
          uni.hideLoading();
          this._saveProfileToCloud(nickname, this.userAvatarUrl || '');
        }
      });
    },
    _saveProfileToCloud(nickname, avatarUrl) {
      const safeAvatar = (avatarUrl || '').startsWith('cloud://') ? avatarUrl : '';
      const previousNickname = this.userNickname;
      const previousAvatar = this.userAvatarUrl;
      this.applyProfileUpdateToVisibleData(nickname, avatarUrl || '', previousNickname, previousAvatar);
      wx.cloud.callFunction({
        name: 'getSteps',
        data: { action: 'updateProfile', nickname, avatarUrl: safeAvatar },
        success: () => {
          if (this.myTeam) this.fetchTeamData();
          this.fetchLeaderboard();
          this.personalEditMode = false;
          this.previousTab = 'profile';
          this.tempNickname = nickname;
          this.tempAvatarUrl = avatarUrl || '';
          uni.hideLoading();
          uni.showToast({ title: '资料已更新', icon: 'success' });
        },
        fail: () => {
          uni.hideLoading();
          uni.showToast({ title: '保存失败，请重试', icon: 'none' });
        }
      });
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
        setTimeout(() => {
          this.drawMap();
          this.updateTeamRouteProgress(false);
        }, 300);
      });

      this.uploadAvatarAndSync(this.tempAvatarUrl, name);
    },
    cancelProfile() {
      this.showProfileModal = false;

      // Redraw map after modal closes
      this.$nextTick(() => {
        setTimeout(() => {
          this.drawMap();
          this.updateTeamRouteProgress(false);
        }, 300);
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
    onPrivacyAgree() {
      this.showPrivacyModal = false;
      if (this.privacyResolve) {
        this.privacyResolve({ buttonId: 'agreePrivacyBtn', event: 'agree' });
        this.privacyResolve = null;
      }
    },
    onPrivacyReject() {
      this.showPrivacyModal = false;
      if (this.privacyResolve) {
        this.privacyResolve({ event: 'ignore' });
        this.privacyResolve = null;
      }
      uni.showToast({ title: '已拒绝，部分功能不可用', icon: 'none' });
    },
    onTeamIdInput(e) {
      this.teamIdInput = e.detail.value;
      this.teamErrorMsg = '';
    },
    submitTeamId() {
      const id = this.teamIdInput.trim().toUpperCase();
      if (!id) { this.teamErrorMsg = '请输入学工号'; return; }
      let foundTeam = '';
      for (const [team, ids] of Object.entries(this.teamData)) {
        if (ids.map(item => item.toUpperCase()).includes(id)) { foundTeam = team; break; }
      }
      if (!foundTeam) {
        this.teamErrorMsg = '未找到该学工号，请确认后重新输入';
        return;
      }
      // Link studentId to cloud record
      wx.cloud.callFunction({
        name: 'getSteps',
        data: { action: 'saveTeamMember', studentId: id },
        success: (res) => {
          if (!res.result || !res.result.success) {
            this.teamErrorMsg = (res.result && res.result.msg) || '加入失败，请重试';
            return;
          }
          this.myTeam = foundTeam;
          this.myStudentId = id;
          this.selectedViewTeam = foundTeam;
          uni.setStorageSync('myTeam', foundTeam);
          uni.setStorageSync('myStudentId', id);
          this.showTeamDialog = false;
          uni.showToast({ title: '成功加入 ' + foundTeam + '！', icon: 'success' });
          this.fetchTeamData();
          this.fetchAllTeamRouteTotals(true);
        },
        fail: () => {
          this.teamErrorMsg = '加入失败，请重试';
        }
      });
    },
    selectViewTeam(team) {
      this.selectedViewTeam = team;
      this.teamMembers = [];
      this.teamTotalKm = 0;
      this.fetchTeamData();
    },
    fetchTeamData() {
      this.teamLoading = true;
      const teamName = this.selectedViewTeam;
      wx.cloud.callFunction({
        name: 'getSteps',
        data: { action: 'getTeamData', teamName },
        success: (res) => {
          // Discard result if user already switched to another team
          if (this.selectedViewTeam !== teamName) return;
          if (res.result && res.result.success) {
            this.teamMembers = res.result.members || [];
            this.teamTotalKm = res.result.totalKm || 0;
            this.teamRouteTotals[teamName] = this.teamTotalKm;
            this.fetchAllTeamRouteTotals(true);
          }
          this.teamLoading = false;
        },
        fail: () => { this.teamLoading = false; }
      });
    },
    cancelTeamDialog() {
      this.showTeamDialog = false;
      if (!this.myTeam) this.activeTab = 'today';
    },
    sendToServer(code, encryptedData, iv, nickname, avatarUrl) {
      const that = this;
      uni.showLoading({ title: '读取中...' });
      wx.cloud.callFunction({
        name: 'getSteps',
        data: { action: 'syncSteps', code, encryptedData, iv, nickname, avatarUrl, studentId: that.myStudentId || '' },
        success: (res) => {
          uni.hideLoading();
          if (res.result && res.result.success) {
            const oldSteps = that.todaysSteps;
            const isNewDay = that.todaysSteps === 0 && res.result.todaySteps > 0;
            that.todaysSteps = res.result.todaySteps;
            if (typeof res.result.totalSteps === 'number') {
              that.totalStepsHistory = res.result.totalSteps;
            } else {
              that.totalStepsHistory = Math.max(0, that.totalStepsHistory - oldSteps + that.todaysSteps);
            }
            if (res.result.rank) that.todayRank = res.result.rank;
            if (isNewDay) that.syncDays += 1;
            that.saveData();
            uni.showToast({ title: '步数已更新！', icon: 'success' });

            if (that.activeTab === 'today') {
              that.fetchAllTeamRouteTotals(true);
              that.initMapAndAnimate(oldSteps, that.todaysSteps);
            } else if (that.activeTab === 'period') {
              that.fetchLeaderboard();
            } else if (that.activeTab === 'teams') {
              that.fetchAllTeamRouteTotals(true);
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
  background-color: #2c7c41;
}

.app {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: #2c7c41;
}

.bg-image {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  background-color: #2c7c41;
}

.top-nav,
.tab1-wrapper,
.tab2-wrapper,
.bottom-nav {
  position: relative;
  z-index: 1;
  width: 100%;
}

/* ── Top Nav ── */
.top-nav {
  background-color: #2c7c41;
  padding: 20rpx 32rpx;
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  box-sizing: border-box;
}

.profile-header-bar {
  width: 100%;
  height: 100rpx;
  flex-shrink: 0;
  background: #2c7c41;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.profile-header-title {
  color: #ffffff;
  font-size: 32rpx;
  font-weight: 700;
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

.nav-row-hidden {
  display: none;
}

.nav-row-2 {
  display: flex;
  flex-direction: row;
  align-items: center;
  min-height: 78rpx;
}

.nav-yellow {
  font-size: 26rpx;
  color: #ffffff;
  font-weight: 500;
}

.nav-gap {
  margin-left: 40rpx;
}

.nav-hint {
  font-size: 24rpx;
  color: #ffffff;
  line-height: 1.2;
}

.sync-btn {
  background-color: #ffffff;
  color: #2d7a4a;
  font-size: 24rpx;
  font-weight: 800;
  border-radius: 40rpx;
  border: 2rpx solid #2d7a4a;
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
  padding-bottom: 0;
}

.map-image-section {
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
  width: 100%;
  min-width: 100%;
}

.map-image {
  width: 100%;
  height: 100%;
  display: block;
  position: absolute;
  inset: 0;
  object-fit: cover;
}

.red-route-overlay-canvas {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}

.map-loading-overlay {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(4px);
  pointer-events: none;
}

.map-loading-spinner {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  border: 6rpx solid rgba(45, 122, 74, 0.18);
  border-top-color: #2d7a4a;
  border-right-color: rgba(45, 122, 74, 0.7);
  animation: spin 0.9s linear infinite;
  margin-bottom: 18rpx;
}

.map-loading-text {
  color: #2d6040;
  font-size: 24rpx;
  font-weight: 600;
  letter-spacing: 0;
}

/* this section was the main section display route code that has been set to display none */
.main-route-code-hidden {
  display: none;
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
  background-color: #f6d18a;
  border-radius: 100rpx;
  padding: 6rpx 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
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

.label-bottom-left {
  top: 100%;
  right: 0;
}

.final-text {
  position: absolute;
  left: 100%;
  margin-left: 36rpx;
  top: 50%;
  transform: translateY(-50%);
  color: #ffffff;
  font-size: 24rpx;
  font-weight: 600;
  white-space: nowrap;
  text-shadow: 0 2rpx 6rpx rgba(0,0,0,0.6);
}

/* Sonar pulse ring for crossed checkpoint dots */
@keyframes sonarPulse {
  0%   { transform: scale(1);   opacity: 0.8; }
  100% { transform: scale(3.5); opacity: 0; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.pulse-ring {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-color: #660000;
  animation: sonarPulse 1.5s infinite ease-out;
  pointer-events: none;
}

.user-marker {
  position: absolute;
  transform: translate(-50%, -100%);
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.user-marker-img {
  width: 36rpx;
  height: 36rpx;
}

.user-marker-steps {
  position: absolute;
  white-space: nowrap;
  color: #ffffff;
  font-size: 18rpx;
  font-weight: 700;
  text-shadow: 0 1rpx 4rpx rgba(0,0,0,0.9);
}
.user-steps-top    { bottom: 100%; margin-bottom: 6rpx; left: 50%; transform: translateX(-50%); }
.user-steps-bottom { top: 100%;    margin-top: 6rpx;    left: 50%; transform: translateX(-50%); }
.user-steps-left   { right: 100%; margin-right: 8rpx; top: 50%; transform: translateY(-50%); }
.user-steps-right  { left: 100%;  margin-left: 8rpx;  top: 50%; transform: translateY(-50%); }

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

.leader-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.leader-name {
  font-size: 28rpx;
  color: #ffffff;
  font-weight: 500;
}

.leader-team {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.45);
  font-weight: 400;
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

/* ── Stats Panel ── */
.stats-panel {
  background-color: #ffffff;
  border-radius: 0;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  padding: 4rpx 0 calc(100rpx + env(safe-area-inset-bottom));
}

.stats-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 20rpx 0;
}

.stats-cell {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 8rpx;
}

.stats-label {
  font-size: 22rpx;
  color: #999999;
  margin-bottom: 8rpx;
  font-weight: 400;
}

.stats-value {
  font-size: 32rpx;
  font-weight: 700;
  color: #222222;
}

.stats-rank {
  font-size: 26rpx;
  color: #2c7c41;
}

.stats-small {
  font-size: 24rpx;
}

.stats-unit {
  font-size: 20rpx;
  font-weight: 400;
  color: #aaaaaa;
}

/* ── Bottom Nav ── */
.bottom-nav {
  background-color: #2c7c41;
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 100rpx;
  padding-bottom: calc(env(safe-area-inset-bottom) / 2);
  flex-shrink: 0;
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
}

.tab2-wrapper,
.tab3-wrapper,
.profile-wrapper {
  padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
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
  background: linear-gradient(160deg, #1e5c35, #2d6040);
  border-radius: 28rpx;
  padding: 48rpx 40rpx;
  width: 600rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 20rpx 60rpx rgba(0,0,0,0.4);
}

.modal-title {
  font-size: 36rpx;
  font-weight: 700;
  color: #f5d76e;
  margin-bottom: 12rpx;
}

.modal-hint {
  font-size: 24rpx;
  color: rgba(255,255,255,0.6);
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
  background-color: rgba(255,255,255,0.15);
  margin-bottom: 12rpx;
  border: 2rpx solid rgba(255,255,255,0.3);
}

.avatar-picker-label {
  font-size: 24rpx;
  color: rgba(255,255,255,0.7);
}

.nickname-input {
  width: 100%;
  height: 84rpx;
  border: 2rpx solid rgba(255,255,255,0.25);
  border-radius: 14rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #ffffff;
  background-color: rgba(255,255,255,0.1);
  margin-bottom: 32rpx;
  box-sizing: border-box;
}

.modal-confirm-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #f5d76e, #e8b94a);
  color: #1a3a20;
  font-size: 30rpx;
  font-weight: 700;
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
  color: rgba(255,255,255,0.4);
  font-size: 26rpx;
  line-height: 80rpx;
}
.modal-cancel-btn::after {
  border: none;
}

.center-box {
  width: 640rpx;
  padding: 40rpx 36rpx 36rpx;
  border-radius: 30rpx;
  background: linear-gradient(160deg, #1f5f37, #2c7c41);
  box-shadow: 0 18rpx 56rpx rgba(0,0,0,0.36);
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
}

.center-top {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 28rpx;
}

.center-avatar-frame {
  width: 150rpx;
  height: 150rpx;
  border-radius: 50%;
  padding: 6rpx;
  background: rgba(255,255,255,0.12);
  box-sizing: border-box;
  margin-bottom: 18rpx;
}

.center-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2rpx solid rgba(255,255,255,0.25);
  background-color: rgba(255,255,255,0.08);
}

.center-name {
  font-size: 38rpx;
  font-weight: 700;
  color: #ffffff;
  text-align: center;
  line-height: 1.25;
}

.center-team {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: rgba(255,255,255,0.68);
}

.center-actions,
.center-edit-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.center-edit-btn,
.center-close-btn {
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  border-radius: 42rpx;
  font-size: 28rpx;
  font-weight: 700;
}

.center-edit-btn {
  background: #f5d76e;
  color: #1a3a20;
  margin-bottom: 14rpx;
}
.center-edit-btn::after {
  border: none;
}

.center-close-btn {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.82);
}
.center-close-btn::after {
  border: none;
}

.center-avatar-picker {
  margin-bottom: 26rpx;
}

.center-nickname-input {
  margin-bottom: 26rpx;
}

/* ── Profile Screen ── */
.profile-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  overflow: hidden;
  background: #2d6040;
  padding: 36rpx 24rpx 24rpx;
  box-sizing: border-box;
}

.profile-shell {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  padding-top: 24rpx;
}

.profile-identity {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.profile-avatar-view,
.profile-avatar-btn {
  width: 156rpx;
  height: 156rpx;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255,255,255,0.10);
}

.profile-avatar-btn {
  background: rgba(255,255,255,0.10);
  border: none;
  padding: 0;
  margin: 0;
}
.profile-avatar-btn::after {
  border: none;
}

.profile-avatar-view {
  margin-bottom: 20rpx;
}

.profile-name-line {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
  padding: 0 20rpx;
  box-sizing: border-box;
  height: 72rpx;
}

.profile-name {
  font-size: 32rpx;
  font-weight: 700;
  color: #ffffff;
  max-width: 520rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-name-input-inline {
  width: 360rpx;
  height: 62rpx;
  line-height: 62rpx;
  padding: 0 18rpx;
  border-radius: 14rpx;
  border: 2rpx solid rgba(255,255,255,0.24);
  background: rgba(255,255,255,0.14);
  color: #ffffff;
  font-size: 30rpx;
  box-sizing: border-box;
}

.profile-name-input-inline::placeholder {
  color: rgba(255,255,255,0.72);
}

.profile-arrow {
  font-size: 42rpx;
  color: rgba(255,255,255,0.95);
  font-weight: 600;
  flex-shrink: 0;
  margin-left: 10rpx;
}

.profile-edit-area {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 36rpx;
}

.profile-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.profile-done-btn {
  width: 180rpx;
  height: 70rpx;
  line-height: 70rpx;
  border-radius: 35rpx;
  background: rgba(255,255,255,0.16);
  color: #ffffff;
  font-size: 26rpx;
  font-weight: 700;
  margin: 0 auto;
}
.profile-done-btn::after {
  border: none;
}

/* ── Tab 3: Teams ── */
.tab3-wrapper {
  flex: 1;
  background-color: #2d6040;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.team-selector-bar {
  background-color: #2c7c41;
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 100rpx;
  flex-shrink: 0;
  padding-bottom: 0;
}

.team-selector-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  position: relative;
}

.team-selector-text {
  font-size: 30rpx;
  font-weight: 500;
}

.team-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 28rpx 28rpx 0;
  box-sizing: border-box;
}

/* Header Banner */
.team-header-banner {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  background: rgba(255,255,255,0.08);
  border-radius: 20rpx;
  padding: 28rpx 32rpx;
  margin-bottom: 20rpx;
  flex-shrink: 0;
  border-bottom: 2rpx solid rgba(245,215,110,0.25);
}

.team-header-info {
  display: flex;
  flex-direction: column;
}

.team-header-name {
  font-size: 38rpx;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 2rpx;
}

.team-header-sub {
  font-size: 22rpx;
  color: rgba(255,255,255,0.5);
  margin-top: 8rpx;
}

.team-header-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.team-header-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
}

.team-total-km {
  font-size: 52rpx;
  font-weight: 700;
  color: #f5d76e;
  line-height: 1;
}

.team-total-km-unit {
  font-size: 22rpx;
  color: #f5d76e;
  font-weight: 600;
  margin-top: 2rpx;
  text-align: right;
}

.team-total-km-label {
  font-size: 20rpx;
  color: rgba(255,255,255,0.45);
  margin-top: 4rpx;
  text-align: right;
}

/* Loading */
.team-loading-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.team-loading-text {
  font-size: 28rpx;
  color: rgba(255,255,255,0.4);
}

/* Member List */
.team-member-list {
  flex: 1;
  height: 1rpx;
}

.team-member-list-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 16rpx 16rpx 16rpx 12rpx;
  border-bottom: 1rpx solid rgba(255,255,255,0.12);
  margin-bottom: 16rpx;
}

.tm-col-rank {
  width: 52rpx;
  font-size: 26rpx;
  color: rgba(255,255,255,0.35);
  text-align: center;
  flex-shrink: 0;
}

.tm-col-name {
  flex: 1;
  font-size: 26rpx;
  color: rgba(255,255,255,0.35);
}

.tm-col-today, .tm-col-total {
  width: 100rpx;
  font-size: 26rpx;
  color: rgba(255,255,255,0.35);
  text-align: right;
}

.team-member-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 28rpx 16rpx 28rpx 12rpx;
  border-radius: 14rpx;
  margin-bottom: 10rpx;
  background: rgba(255,255,255,0.05);
}

.tm-rank {
  width: 52rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: #ffffff;
  text-align: center;
  flex-shrink: 0;
}

.tm-rank-gold,
.tm-rank-silver,
.tm-rank-bronze {
  color: #ffffff;
}

.tm-avatar-wrap {
  width: 64rpx;
  height: 64rpx;
  border-radius: 10rpx;
  overflow: hidden;
  margin: 0 18rpx 0 10rpx;
  flex-shrink: 0;
  background-color: rgba(255,255,255,0.1);
}

.tm-avatar {
  width: 64rpx;
  height: 64rpx;
}

.tm-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.tm-name {
  font-size: 28rpx;
  color: #ffffff;
  font-weight: 500;
}

.tm-id {
  font-size: 20rpx;
  color: rgba(255,255,255,0.35);
  margin-top: 4rpx;
}

.tm-today-wrap, .tm-cumulative-wrap {
  width: 100rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.tm-today {
  font-size: 26rpx;
  font-weight: 600;
  color: rgba(255,255,255,0.75);
}

.tm-cumulative {
  font-size: 26rpx;
  color: #f5d76e;
  font-weight: 700;
}

.tm-unit {
  font-size: 18rpx;
  color: rgba(255,255,255,0.3);
  margin-top: 2rpx;
}

.team-empty {
  padding: 80rpx 0 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.team-empty-text {
  font-size: 28rpx;
  color: rgba(255,255,255,0.5);
}

.team-empty-hint {
  font-size: 22rpx;
  color: rgba(255,255,255,0.25);
}

.team-total-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 16rpx;
  border-top: 1rpx solid rgba(255,255,255,0.12);
  margin-top: 8rpx;
}

.team-total-label {
  font-size: 26rpx;
  color: rgba(255,255,255,0.6);
  font-weight: 500;
}

.team-total-value {
  font-size: 34rpx;
  font-weight: 700;
  color: #f5d76e;
}


/* ── Team Dialog ── */
.team-dialog-box {
  background: linear-gradient(160deg, #1e5c35, #2d6040);
  border-radius: 32rpx;
  padding: 48rpx 40rpx 40rpx;
  width: 620rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 20rpx 60rpx rgba(0,0,0,0.4);
}

.team-dialog-header {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 36rpx;
}

.team-dialog-icon-img {
  width: 100rpx;
  height: 100rpx;
  margin-bottom: 16rpx;
}

.team-dialog-title {
  font-size: 40rpx;
  font-weight: 700;
  color: #f5d76e;
  margin-bottom: 10rpx;
}

.team-dialog-subtitle {
  font-size: 24rpx;
  color: rgba(255,255,255,0.65);
  text-align: center;
}

.team-input-wrap {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 16rpx;
}

.team-input {
  width: 100%;
  height: 88rpx;
  border: 2rpx solid rgba(255,255,255,0.25);
  border-radius: 16rpx;
  padding: 0 28rpx;
  font-size: 30rpx;
  color: #ffffff;
  background-color: rgba(255,255,255,0.1);
  box-sizing: border-box;
}

.team-input-placeholder {
  color: rgba(255,255,255,0.35);
  font-size: 28rpx;
}

.team-error-msg {
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 8rpx;
}

.team-error-text {
  font-size: 22rpx;
  color: #f5d76e;
}

.team-enter-btn {
  width: 100%;
  height: 92rpx;
  background: linear-gradient(135deg, #f5d76e, #e8b94a);
  color: #1a3a20;
  font-size: 32rpx;
  font-weight: 700;
  border-radius: 46rpx;
  line-height: 92rpx;
  margin-top: 24rpx;
  margin-bottom: 0;
  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.2);
}
.team-enter-btn::after { border: none; }

.team-cancel-btn {
  width: 100%;
  height: 76rpx;
  background: none;
  color: rgba(255,255,255,0.4);
  font-size: 26rpx;
  line-height: 76rpx;
  margin-top: 8rpx;
}
.team-cancel-btn::after { border: none; }

/* ── Privacy Modal ── */
.privacy-box {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx 36rpx;
  width: 600rpx;
  display: flex;
  flex-direction: column;
}

.privacy-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #1a3a20;
  margin-bottom: 20rpx;
  text-align: center;
}

.privacy-body {
  font-size: 26rpx;
  color: #555;
  line-height: 1.6;
  margin-bottom: 20rpx;
}

.privacy-list {
  background: #f5f5f5;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 36rpx;
}

.privacy-item {
  font-size: 24rpx;
  color: #444;
  line-height: 1.8;
  display: block;
}

.privacy-btns {
  display: flex;
  flex-direction: row;
  gap: 20rpx;
}

.privacy-btn-cancel {
  flex: 1;
  height: 80rpx;
  background: #f0f0f0;
  color: #888;
  font-size: 28rpx;
  border-radius: 40rpx;
  line-height: 80rpx;
}
.privacy-btn-cancel::after { border: none; }

.privacy-btn-agree {
  flex: 1;
  height: 80rpx;
  background: #2c7c41;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
  border-radius: 40rpx;
  line-height: 80rpx;
}
.privacy-btn-agree::after { border: none; }
</style>

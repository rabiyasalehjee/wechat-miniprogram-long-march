<template>
  <view class="app">
    <image v-if="activeTab !== 'teams'" class="bg-image" src="/static/bg-img.png" mode="aspectFill" />

    <!-- Top Nav Bar (hidden on teams tab) -->
    <view v-if="activeTab !== 'teams'" class="top-nav">
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
      <view class="map-image-section">
        <image class="map-image" src="/static/map-img.png" mode="aspectFill" />
        <canvas
          canvas-id="redRouteOverlayCanvas"
          id="redRouteOverlayCanvas"
          class="red-route-overlay-canvas"
        ></canvas>
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
              :src="item.avatarUrl || '/static/default-avatar.png'"
              mode="aspectFill"
              @error="item.avatarUrl = '/static/default-avatar.png'"
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
          <view class="team-header-stat">
            <text class="team-total-km">{{ teamTotalKm }}</text>
            <text class="team-total-km-unit">公里</text>
            <text class="team-total-km-label">团队总里程</text>
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
            :class="{ 'team-member-mine': m.studentId === myStudentId }"
          >
            <text class="tm-rank" :class="{ 'tm-rank-gold': i === 0, 'tm-rank-silver': i === 1, 'tm-rank-bronze': i === 2 }">{{ i + 1 }}</text>
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
      teamIdInput: '',
      teamErrorMsg: '',
      myTeam: '',
      myStudentId: '',
      selectedViewTeam: 'Team1',
      teamMembers: [],
      teamTotalKm: 0,
      teamLoading: false,
      teamChineseName: {
        'Team1': '红25军', 'Team2': '红二方面军', 'Team3': '红四方面军', 'Team4': '红一方面军'
      },
      teamColors: {
        'Team1': { primary: '#c0392b', light: 'rgba(192,57,43,0.15)', name: '红队' },
        'Team2': { primary: '#2980b9', light: 'rgba(41,128,185,0.15)', name: '蓝队' },
        'Team3': { primary: '#d35400', light: 'rgba(211,84,0,0.15)',   name: '橙队' },
        'Team4': { primary: '#8e44ad', light: 'rgba(142,68,173,0.15)', name: '紫队' }
      },
      teamData: {
        'Team1': ['21B908040','23B308006','23B908051','24B908021','25B308027','21B908014','22B908026','23B908033','25B908031','25B308018','22B908036'],
        'Team2': ['20B908016','20B908054','21B908043','22B908022','23B308002','23B908038','23B908056','24B308009','24B908037','24B908045','25B308017','20B908061','22B308004','24B908040','25B308008','24B308016','22B908019','18B908028','18B908088','19B908065','21B908039'],
        'Team3': ['18B908105','20B908060','22B908035','22B908040','23B908031','24B908032','24B908041','23B908035','23B908061','25B308023','22B908037'],
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
      this.$nextTick(() => {
        setTimeout(() => {
          this.drawRedRouteOverlay();
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
        } else {
          // Animation done — place the checkpoint marker at the final position
          this.computeUserPosition();
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
      if (savedSteps) {
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
          setTimeout(() => {
            this.drawRedRouteOverlay();
            this.drawnSteps = this.todaysSteps; // Snap directly on tab switch
            this.initMapAndAnimate(this.todaysSteps, this.todaysSteps);
          }, 100);
        });
      }
    },
    drawRedRouteOverlay() {
      const query = uni.createSelectorQuery().in(this);
      query.select('.map-image-section').boundingClientRect(rect => {
        if (!rect) return;
        const width = rect.width;
        const height = rect.height;
        const ctx = uni.createCanvasContext('redRouteOverlayCanvas', this);
        const p = (x, y) => ({ x: (x / 100) * width, y: (y / 100) * height });
        const drawPath = (points, strokeWidth) => {
          if (!points.length) return;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const cur = points[i];
            const cx = (prev.x + cur.x) / 2 + (i % 2 === 0 ? -18 : 18);
            const cy = (prev.y + cur.y) / 2 + (i % 3 === 0 ? 14 : -10);
            ctx.quadraticCurveTo(cx, cy, cur.x, cur.y);
          }
          ctx.setStrokeStyle('rgba(190, 23, 30, 0.86)');
          ctx.setLineWidth(strokeWidth);
          ctx.setLineCap('round');
          ctx.setLineJoin('round');
          ctx.stroke();
        };
        const drawRouteDot = point => {
          ctx.beginPath();
          ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
          ctx.setFillStyle('rgba(190, 23, 30, 0.95)');
          ctx.fill();
          ctx.setStrokeStyle('rgba(255, 245, 220, 0.9)');
          ctx.setLineWidth(1.5);
          ctx.stroke();
        };

        ctx.clearRect(0, 0, width, height);
        const routePoints = [
          p(50, 92), p(41, 88), p(31, 90), p(20, 84), p(13, 76),
          p(22, 70), p(31, 73), p(25, 65), p(15, 60), p(23, 53),
          p(34, 56), p(29, 48), p(18, 44), p(27, 37), p(39, 40),
          p(34, 32), p(23, 28), p(32, 24), p(43, 27), p(38, 21),
          p(48, 17), p(54, 15)
        ];
        drawPath(routePoints, 2);
        [4, 9, 14, 19].forEach(i => drawRouteDot(routePoints[i]));
        ctx.draw();
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
      for (const [team, ids] of Object.entries(this.teamData)) {
        if (ids.includes(item.studentId)) {
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
      const id = this.teamIdInput.trim();
      if (!id) { this.teamErrorMsg = '请输入学工号'; return; }
      let foundTeam = '';
      for (const [team, ids] of Object.entries(this.teamData)) {
        if (ids.includes(id)) { foundTeam = team; break; }
      }
      if (!foundTeam) {
        this.teamErrorMsg = '未找到该学工号，请确认后重新输入';
        return;
      }
      this.myTeam = foundTeam;
      this.myStudentId = id;
      this.selectedViewTeam = foundTeam;
      uni.setStorageSync('myTeam', foundTeam);
      uni.setStorageSync('myStudentId', id);
      this.showTeamDialog = false;
      uni.showToast({ title: '成功加入 ' + foundTeam + '！', icon: 'success' });
      // Link studentId to cloud record
      wx.cloud.callFunction({ name: 'getSteps', data: { action: 'saveTeamMember', studentId: id } });
      this.fetchTeamData();
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
    leaveTeam() {
      uni.showModal({
        title: '退出团队',
        content: '确定要退出当前团队吗？',
        confirmText: '退出',
        confirmColor: '#c0392b',
        success: (res) => {
          if (res.confirm) {
            wx.cloud.callFunction({ name: 'getSteps', data: { action: 'clearTeamMember' } });
            this.myTeam = '';
            this.myStudentId = '';
            uni.removeStorageSync('myTeam');
            uni.removeStorageSync('myStudentId');
            this.teamIdInput = '';
            this.teamErrorMsg = '';
            this.showTeamDialog = true;
          }
        }
      });
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
            that.totalStepsHistory = res.result.totalSteps || that.totalStepsHistory;
            if (res.result.rank) that.todayRank = res.result.rank;
            if (isNewDay) that.syncDays += 1;
            that.saveData();
            uni.showToast({ title: '步数已更新！', icon: 'success' });

            if (that.activeTab === 'today') {
              that.initMapAndAnimate(oldSteps, that.todaysSteps);
            } else if (that.activeTab === 'period') {
              that.fetchLeaderboard();
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
  background-color: #2c7c41;
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
  color: #ffffff;
  font-weight: 500;
}

.nav-gap {
  margin-left: 40rpx;
}

.nav-hint {
  font-size: 24rpx;
  color: #ffffff;
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
}

.map-image-section {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
}

.map-image {
  width: 100%;
  height: 100%;
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
  padding: 4rpx 0 0;
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

.team-leave-btn {
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.5);
  font-size: 22rpx;
  border-radius: 30rpx;
  border: 1rpx solid rgba(255,255,255,0.2);
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 24rpx;
  flex-shrink: 0;
  margin-left: 16rpx;
}
.team-leave-btn::after { border: none; }

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

.team-member-mine {
  background: rgba(245,215,110,0.12);
  border: 1rpx solid rgba(245,215,110,0.3);
}

.tm-rank {
  width: 52rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: rgba(255,255,255,0.3);
  text-align: center;
  flex-shrink: 0;
}

.tm-rank-gold   { color: #f5d76e; }
.tm-rank-silver { color: #c0c0c0; }
.tm-rank-bronze { color: #cd7f32; }

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

<script>
	export default {
		onLaunch: function() {
			// Initialize WeChat Cloud
			if (wx.cloud) {
				wx.cloud.init({ env: 'cloud1-d5gm01xjv12142933', traceUser: true });
			}

			// ── Privacy authorization handler (required by WeChat privacy rules) ──
			// WeChat calls this automatically before any sensitive API (getWeRunData, chooseAvatar, etc.)
			// We must call resolve({ buttonId, event }) to confirm, or resolve({ event: 'ignore' }) to cancel.
			if (wx.onNeedPrivacyAuthorization) {
				wx.onNeedPrivacyAuthorization(resolve => {
					// Show WeChat's built-in privacy popup, then resolve when user taps agree
					uni.$emit('needPrivacyAuth', resolve);
				});
			}
		},
		onShow: function() {},
		onHide: function() {}
	}
</script>

<style>
	/* Global styles */
</style>
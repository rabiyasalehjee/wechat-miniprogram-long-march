<script>
	export default {
		onLaunch: function() {
			console.log('App Launch');
			// Initialize WeChat Cloud — env will be resolved dynamically
			if (wx.cloud) {
				wx.cloud.init({ env: 'cloud1-1gs1ugxif2016ac5', traceUser: true });
				console.log('wx.cloud initialized');
			}
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		}
	}
</script>

<style>
	/* Global styles */
</style>
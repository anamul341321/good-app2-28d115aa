package com.anamul.goodapp;

import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.view.Gravity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.unity3d.ads.IUnityAdsInitializationListener;
import com.unity3d.ads.IUnityAdsLoadListener;
import com.unity3d.ads.IUnityAdsShowListener;
import com.unity3d.ads.UnityAds;
import com.unity3d.services.banners.BannerErrorInfo;
import com.unity3d.services.banners.BannerView;
import com.unity3d.services.banners.UnityBannerSize;

/**
 * Unity Ads bridge for Good-App.
 * Unity Ads serves real ads without a Play Store listing and is the only
 * ad network used by the app (AdMob has been removed).
 */
@CapacitorPlugin(name = "UnityAds")
public class UnityAdsPlugin extends Plugin {
    private boolean initialized = false;
    private BannerView bannerView = null;
    private FrameLayout bannerHolder = null;

    @PluginMethod
    public void initialize(final PluginCall call) {
        final String gameId = call.getString("gameId", "");
        final boolean testMode = Boolean.TRUE.equals(call.getBoolean("testMode", false));
        if (gameId == null || gameId.isEmpty()) {
            call.reject("Unity gameId missing");
            return;
        }
        if (initialized) {
            call.resolve(new JSObject().put("initialized", true));
            return;
        }
        getActivity().runOnUiThread(() -> UnityAds.initialize(
            getActivity().getApplicationContext(),
            gameId,
            testMode,
            new IUnityAdsInitializationListener() {
                @Override
                public void onInitializationComplete() {
                    initialized = true;
                    call.resolve(new JSObject().put("initialized", true));
                }

                @Override
                public void onInitializationFailed(UnityAds.UnityAdsInitializationError error, String message) {
                    call.reject("Unity init failed: " + error + " " + message);
                }
            }
        ));
    }

    /** Loads and shows a full-screen (interstitial or rewarded) placement. */
    @PluginMethod
    public void show(final PluginCall call) {
        final String placementId = call.getString("placementId", "");
        if (placementId == null || placementId.isEmpty()) {
            call.reject("placementId missing");
            return;
        }
        if (!initialized) {
            call.reject("Unity Ads is not initialized");
            return;
        }
        UnityAds.load(placementId, new IUnityAdsLoadListener() {
            @Override
            public void onUnityAdsAdLoaded(String id) {
                UnityAds.show(getActivity(), id, new IUnityAdsShowListener() {
                    @Override
                    public void onUnityAdsShowFailure(String p, UnityAds.UnityAdsShowError error, String message) {
                        call.reject("Unity show failed: " + error + " " + message);
                    }

                    @Override
                    public void onUnityAdsShowStart(String p) {}

                    @Override
                    public void onUnityAdsShowClick(String p) {}

                    @Override
                    public void onUnityAdsShowComplete(String p, UnityAds.UnityAdsShowCompletionState state) {
                        JSObject result = new JSObject();
                        result.put("shown", true);
                        result.put("completed", state == UnityAds.UnityAdsShowCompletionState.COMPLETED);
                        call.resolve(result);
                    }
                });
            }

            @Override
            public void onUnityAdsFailedToLoad(String id, UnityAds.UnityAdsLoadError error, String message) {
                call.reject("Unity load failed: " + error + " " + message);
            }
        });
    }

    @PluginMethod
    public void showBanner(final PluginCall call) {
        final String placementId = call.getString("placementId", "");
        if (placementId == null || placementId.isEmpty()) {
            call.reject("placementId missing");
            return;
        }
        if (!initialized) {
            call.reject("Unity Ads is not initialized");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                if (bannerView != null) {
                    call.resolve(new JSObject().put("shown", true));
                    return;
                }
                ViewGroup root = (ViewGroup) getActivity().getWindow().getDecorView()
                    .findViewById(android.R.id.content);
                bannerHolder = new FrameLayout(getActivity());
                FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                );
                params.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
                root.addView(bannerHolder, params);

                bannerView = new BannerView(getActivity(), placementId, UnityBannerSize.getDynamicSize(getActivity()));
                bannerView.setListener(new BannerView.IListener() {
                    @Override
                    public void onBannerLoaded(BannerView view) {}

                    @Override
                    public void onBannerShown(BannerView view) {}

                    @Override
                    public void onBannerClick(BannerView view) {}

                    @Override
                    public void onBannerFailedToLoad(BannerView view, BannerErrorInfo info) {}

                    @Override
                    public void onBannerLeftApplication(BannerView view) {}
                });
                bannerHolder.addView(bannerView);
                bannerView.load();
                call.resolve(new JSObject().put("shown", true));
            } catch (Exception e) {
                call.reject("Unity banner failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void hideBanner(final PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                if (bannerView != null) {
                    bannerView.destroy();
                    bannerView = null;
                }
                if (bannerHolder != null && bannerHolder.getParent() instanceof ViewGroup) {
                    ((ViewGroup) bannerHolder.getParent()).removeView(bannerHolder);
                    bannerHolder = null;
                }
            } catch (Exception ignored) {}
            call.resolve();
        });
    }
}

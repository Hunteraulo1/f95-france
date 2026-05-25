/** Types minimaux pour l’API iframe YouTube (lecteur audio masqué). */
export {};

declare global {
	interface Window {
		onYouTubeIframeAPIReady?: () => void;
		YT?: {
			Player: new (
				elementId: string,
				options: {
					height?: string | number;
					width?: string | number;
					videoId?: string;
					playerVars?: Record<string, string | number>;
					events?: {
						onReady?: (event: { target: YTPlayer }) => void;
						onStateChange?: (event: { data: number; target: YTPlayer }) => void;
						onError?: (event: { data: number }) => void;
					};
				}
			) => YTPlayer;
			PlayerState: {
				UNSTARTED: number;
				ENDED: number;
				PLAYING: number;
				PAUSED: number;
				BUFFERING: number;
				CUED: number;
			};
		};
	}

	interface YTPlayer {
		playVideo: () => void;
		pauseVideo: () => void;
		destroy: () => void;
	}
}

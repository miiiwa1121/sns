'use client';

import React, { useState, useRef, useEffect } from 'react';
import { HighlightClip } from '@/lib/types';
import { Play, Pause, Volume2, VolumeX, Heart, MessageCircle, Share2, Download, CheckCircle2 } from 'lucide-react';

interface VideoPlayerMockProps {
  clip: HighlightClip;
  projectTitle: string;
}

export const VideoPlayerMock: React.FC<VideoPlayerMockProps> = ({ clip, projectTitle }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);

  // 実際のレンダリング済み動画ファイル
  const realVideoUrl = '/videos/short_clip_1.mp4';

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const total = videoRef.current.duration || clip.duration;
      setProgress((current / total) * 100);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '14px'
    }}>
      {/* 9:16 Smartphone Frame */}
      <div style={{
        width: '290px',
        height: '515px',
        borderRadius: '32px',
        overflow: 'hidden',
        position: 'relative',
        background: '#07090e',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(99, 102, 241, 0.35)',
        border: '6px solid #1f293d',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        userSelect: 'none'
      }}>
        {/* Real Rendered MP4 Video Element */}
        <video
          ref={videoRef}
          src={realVideoUrl}
          autoPlay
          loop
          muted={isMuted}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onClick={togglePlay}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            cursor: 'pointer',
            zIndex: 1
          }}
        />

        {/* Top bar overlay */}
        <div style={{
          position: 'relative',
          zIndex: 10,
          padding: '16px 14px 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none'
        }}>
          <span style={{
            fontSize: '0.65rem',
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '3px 10px',
            borderRadius: '10px',
            fontWeight: 800,
            color: '#38bdf8',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            backdropFilter: 'blur(8px)'
          }}>
            1080 x 1920 • MP4 H.264
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            style={{
              pointerEvents: 'auto',
              background: 'rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '50%',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>
        </div>

        {/* Bottom Area: Social UI Overlays (TikTok/Reels format) */}
        <div style={{
          position: 'relative',
          zIndex: 10,
          padding: '0 12px 10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          pointerEvents: 'none'
        }}>
          {/* Creator & Caption Info */}
          <div style={{ maxWidth: '190px' }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#ffffff', marginBottom: '2px', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
              @ai_pulse_lab
            </div>
            <div style={{
              fontSize: '0.72rem',
              color: '#e2e8f0',
              lineHeight: 1.3,
              marginBottom: '6px',
              textShadow: '0 2px 4px rgba(0,0,0,0.8)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {clip.title}
            </div>
          </div>

          {/* Right Action Icons (Like, Comment, Share) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', pointerEvents: 'auto' }}>
            <button
              onClick={() => setLiked(!liked)}
              style={{
                background: 'none',
                border: 'none',
                color: liked ? 'var(--color-yt)' : '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              <Heart size={22} fill={liked ? 'var(--color-yt)' : 'none'} />
              <span style={{ fontSize: '0.62rem', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>24.8K</span>
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: '#ffffff' }}>
              <MessageCircle size={22} />
              <span style={{ fontSize: '0.62rem', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>642</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: '#ffffff' }}>
              <Share2 size={22} />
              <span style={{ fontSize: '0.62rem', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>シェア</span>
            </div>
          </div>
        </div>

        {/* Video Timeline Scrubber */}
        <div style={{
          position: 'relative',
          zIndex: 15,
          width: '100%',
          height: '4px',
          background: 'rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'var(--accent-cyan)',
            transition: 'width 0.1s linear'
          }} />
        </div>
      </div>

      {/* Controller & Download Action Strip */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'rgba(0, 0, 0, 0.5)',
        padding: '8px 16px',
        borderRadius: '24px',
        border: '1px solid var(--border-subtle)'
      }}>
        <button
          onClick={togglePlay}
          style={{
            background: 'none',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            fontWeight: 600
          }}
        >
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
          <span>{isPlaying ? '一時停止' : '再生'}</span>
        </button>

        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>|</span>

        <span style={{ fontSize: '0.78rem', color: 'var(--accent-emerald)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <CheckCircle2 size={13} />
          <span>Remotion レンダリング済み (7.3MB)</span>
        </span>

        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>|</span>

        <a
          href={realVideoUrl}
          download="short_clip_1.mp4"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--accent-cyan)',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: 'pointer',
            textDecoration: 'none'
          }}
          title="生成されたMP4動画をダウンロード"
        >
          <Download size={14} />
          <span>保存</span>
        </a>
      </div>
    </div>
  );
};

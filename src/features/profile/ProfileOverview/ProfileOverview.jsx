import './profileOverview.css';
import mockData from './mockData.js';
import IdentityCard from './components/IdentityCard.jsx';
import ScoreBreakdown from './components/ScoreBreakdown.jsx';
import ActivityPatterns from './components/ActivityPatterns.jsx';
import TechStack from './components/TechStack.jsx';
import NetworkTrace from './components/NetworkTrace.jsx';
import StorageStatus from './components/StorageStatus.jsx';
import SecurityStatus from './components/SecurityStatus.jsx';
import LocationInference from './components/LocationInference.jsx';
import BehavioralTags from './components/BehavioralTags.jsx';

export default function ProfileOverview({ profileData = mockData }) {
  return (
    <div className="po-stack">
      <IdentityCard
        profile={profileData.profile}
        identity={profileData.identity}
        behavioral={profileData.behavioral}
      />
      <ScoreBreakdown scores={profileData.scores} />
      <ActivityPatterns
        activity={profileData.activity}
        lastActivity={profileData.profile.last_activity}
      />

      <div className="po-grid">
        <TechStack techStack={profileData.tech_stack} />
        <NetworkTrace network={profileData.network} />
        <StorageStatus storage={profileData.storage} />
        <SecurityStatus security={profileData.security} />
        <LocationInference
          identity={profileData.identity}
          behavioral={profileData.behavioral}
        />
        <BehavioralTags
          behavioral={profileData.behavioral}
          lifestyle={profileData.lifestyle}
        />
      </div>
    </div>
  );
}

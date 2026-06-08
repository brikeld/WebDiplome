/** Capsule-level analysis loader shown during is-tell-loading (both-states prototype). */
export default function TellAnalysisLoader() {
  return (
    <div className="tell-analysis-loader" aria-hidden="true">
      <div className="tell-analysis-loader__card">
        <div className="tell-analysis-loader__top">
          <span>Signal analysis</span>
          <b>Live trace</b>
        </div>
        <div className="tell-analysis-loader__scope">
          <span className="tell-analysis-loader__ring" />
          <span className="tell-analysis-loader__scan" />
          <span className="tell-analysis-loader__core" />
        </div>
        <div className="tell-analysis-loader__copy">
          <strong>COMPLIANT thinking process</strong>
          <span>Ranking evidence, confidence, and persona fit</span>
        </div>
        <div className="tell-analysis-loader__progress">
          <span />
        </div>
        <div className="tell-analysis-loader__metrics">
          <span>App signals</span>
          <span>Recent files</span>
          <span>Post rationale</span>
        </div>
      </div>
    </div>
  );
}

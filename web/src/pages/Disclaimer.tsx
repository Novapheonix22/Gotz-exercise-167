import { CONTACT_EMAIL, SITE_NAME } from '../site';

interface Props {
  /** Shown on first visit: an "I understand" button. Omit when viewing from the menu. */
  onAccept?: () => void;
}

export default function Disclaimer({ onAccept }: Props) {
  return (
    <main className="page narrow">
      <h1>Before you start</h1>
      <p className="lead">{SITE_NAME} is an unofficial, private, non-commercial fan project.</p>

      <section className="notice">
        <h2>Not affiliated with Wizards of the Coast</h2>
        <p>
          {SITE_NAME} is unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy. It is not
          approved, endorsed, sponsored or specifically approved by Wizards of the Coast LLC. Portions of the materials
          used are property of Wizards of the Coast. ©Wizards of the Coast LLC.
        </p>
        <p>
          Magic: The Gathering, the mana symbols, card frame designs, set symbols and related names and marks are
          trademarks or property of Wizards of the Coast LLC. Frame images come from the community project Card
          Conjurer. No claim of ownership is made over any of them.
        </p>
      </section>

      <section className="notice">
        <h2>Private and free</h2>
        <ul>
          <li><strong>Private:</strong> made for a handful of friends to design custom cards for casual games together online. Accounts are by invitation only; there is no public sign-up, and the site asks search engines not to list it.</li>
          <li><strong>Non-commercial:</strong> no ads, no paid features, no subscriptions, no donations. Nothing made here is sold, and no one makes money from this site.</li>
          <li><strong>Not for counterfeits:</strong> cards made here are custom designs for personal play. They must not be printed and passed off as real cards, sold, or traded.</li>
          <li><strong>No data sold:</strong> the only personal data kept is your login email and the cards you make.</li>
        </ul>
      </section>

      <section className="notice">
        <h2>Rights holders</h2>
        <p>
          If you own something used here and want it removed, it will be taken down promptly, no questions asked.
          {CONTACT_EMAIL ? (
            <> Contact <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</>
          ) : null}
        </p>
      </section>

      {onAccept ? (
        <button type="button" className="primary wide" onClick={onAccept}>I understand, continue</button>
      ) : null}
    </main>
  );
}

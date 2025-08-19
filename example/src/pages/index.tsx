import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">A Live Demonstration Site</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs">
            Explore the Demo
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`Demo for ${siteConfig.title}`}
      description="A live demonstration site for the docusaurus-plugin-resistogram.">
      <HomepageHeader />
      <main>
        <section className={styles.features} style={{padding: '2rem 0'}}>
          <div className="container">
            <div className="row">
              <div className={clsx('col col--6 margin-bottom--lg')}>
                <div className={clsx('text--center padding--md', styles.infoBox)}>
                  <div>
                    <Heading as="h3">Welcome!</Heading>
                    <p>This website is a live demonstration of the <strong>docusaurus-plugin-resistogram</strong>.</p>
                    <p>Here you can see the plugin in action, explore its features, and understand how it can be used to display complex scientific data in a clear and interactive way.</p>
                  </div>
                  <Link
                    className="button button--outline button--primary"
                    to="/docs">
                    Start Exploring
                  </Link>
                </div>
              </div>
              <div className={clsx('col col--6 margin-bottom--lg')}>
                <div className={clsx('text--center padding--md', styles.infoBox)}>
                  <div>
                    <Heading as="h3">About the Data</Heading>
                    <p>The data used in this demo is sourced from the public <strong>Clinical Antibiogram Dataset</strong> and has been curated for this demonstration.</p>
                    <p>The repository for this dataset serves as a practical template for preparing your own data for the plugin.</p>
                  </div>
                  <Link
                    className="button button--outline button--info"
                    to="https://github.com/Uli-Z/dataset-antibiotic-resistance">
                    View Data Repository
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
